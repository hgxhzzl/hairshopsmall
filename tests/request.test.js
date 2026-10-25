/**
 * 请求封装的回归测试。
 *
 * 小程序里所有接口都走 services/_request.js 这一个出口，所以它的几个约定
 * 一旦被改坏，影响面是全站：
 *   1. query 里 undefined / 空串必须丢弃（避免后端把 "" 当成筛选条件）；
 *   2. 默认超时 15s，但账本下载这类大响应可以单独放宽（曾因为默认 15s
 *      必然先超时，用户看到「网络请求失败」而后端还在生成 PDF）；
 *   3. 401 要清会话并跳登录，且并发 401 只能跳一次。
 *
 * 这里用 global.getApp / global.wx 打桩，不依赖微信运行时。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const REQUEST_MODULE = '../manager/services/_request';

/**
 * 加载一份全新的 _request 模块（清掉 require 缓存，隔离模块内的
 * isRedirectingToLogin 状态）。
 */
function loadRequest({ apiBaseUrl = 'https://api.test/api', session = null, onRequest } = {}) {
  const calls = { requests: [], redirects: [], cleared: 0 };

  global.getApp = () => ({
    globalData: { apiBaseUrl, session },
    clearStoredSession() {
      calls.cleared += 1;
    },
  });

  global.wx = {
    request(options) {
      calls.requests.push(options);
      if (onRequest) onRequest(options, calls);
    },
    redirectTo(options) {
      calls.redirects.push(options);
    },
  };

  delete require.cache[require.resolve(REQUEST_MODULE)];
  const mod = require(REQUEST_MODULE);
  return { request: mod.request, mod, calls };
}

function respondOk(payload = {}) {
  return (options) => options.success({ statusCode: 200, data: payload });
}

test('query 丢弃 undefined 与空串，保留 0 和数字', async () => {
  const { request, calls } = loadRequest({ onRequest: respondOk() });

  await request('/consumption-orders', {
    query: {
      member_id: 3,
      page: 1,
      pageSize: 20,
      create_time_start: '',
      create_time_end: undefined,
      pay_type: 0,
    },
  });

  assert.equal(
    calls.requests[0].url,
    'https://api.test/api/consumption-orders?member_id=3&page=1&pageSize=20&pay_type=0',
  );
});

test('query 为空时不追加问号', async () => {
  const { request, calls } = loadRequest({ onRequest: respondOk() });

  await request('/members', { query: { create_time_start: '' } });

  assert.equal(calls.requests[0].url, 'https://api.test/api/members');
});

test('显式 token 优先，未传时取 globalData.session.token', async () => {
  const withExplicit = loadRequest({ session: { token: 'session-token' }, onRequest: respondOk() });
  await withExplicit.request('/members', { token: 'explicit-token' });
  assert.equal(withExplicit.calls.requests[0].header.Authorization, 'Bearer explicit-token');

  const withSession = loadRequest({ session: { token: 'session-token' }, onRequest: respondOk() });
  await withSession.request('/members');
  assert.equal(withSession.calls.requests[0].header.Authorization, 'Bearer session-token');

  const anonymous = loadRequest({ onRequest: respondOk() });
  await anonymous.request('/members');
  assert.equal(anonymous.calls.requests[0].header.Authorization, undefined);
});

test('默认超时 15s，账本下载这类长任务按传入值放宽', async () => {
  const { request, calls } = loadRequest({ onRequest: respondOk() });

  await request('/members');
  assert.equal(calls.requests[0].timeout, 15000);

  await request('/members/account-book/generate', { method: 'POST', timeout: 120000 });
  assert.equal(calls.requests[1].timeout, 120000);
});

test('responseType 透传，二进制下载不会被当成文本', async () => {
  const { request, calls } = loadRequest({ onRequest: respondOk() });

  await request('/members/account-book/files/a.pdf', { responseType: 'arraybuffer' });

  assert.equal(calls.requests[0].responseType, 'arraybuffer');
  assert.equal(calls.requests[0].method, 'GET');
});

test('非 2xx 直接把后端 message 抛给页面', async () => {
  const { request } = loadRequest({
    onRequest: (options) =>
      options.success({ statusCode: 400, data: { message: 'pageSize 不能超过 100' } }),
  });

  await assert.rejects(() => request('/members'), /pageSize 不能超过 100/);
});

test('非 2xx 且没有 message 时给出兜底文案', async () => {
  const { request } = loadRequest({
    onRequest: (options) => options.success({ statusCode: 500, data: 'Internal Error' }),
  });

  await assert.rejects(() => request('/members'), /请求失败，请稍后重试/);
});

test('网络失败时抛出 errMsg', async () => {
  const { request } = loadRequest({
    onRequest: (options) => options.fail({ errMsg: 'request:fail timeout' }),
  });

  await assert.rejects(() => request('/members'), /request:fail timeout/);
});

test('401 清会话并跳登录，并发 401 只跳一次', async () => {
  const { request, calls } = loadRequest({
    session: { token: 'expired' },
    onRequest: (options) => options.success({ statusCode: 401, data: { message: '未授权' } }),
  });

  const results = await Promise.allSettled([request('/members'), request('/services')]);

  assert.equal(calls.cleared, 1);
  assert.equal(calls.redirects.length, 1);
  assert.equal(calls.redirects[0].url, '/pages/login/index');
  results.forEach((result) => {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /登录已过期/);
  });
});
