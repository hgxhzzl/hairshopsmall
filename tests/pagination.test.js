/**
 * 列表分页判断的回归测试。
 *
 * 背景：消费/充值列表曾经用 `rows.length >= pageSize` 判断是否还有下一页，
 * 总条数正好是 pageSize 整数倍时会多发一次必定为空的请求；后来统一改成用后端
 * 返回的 pagination.totalPages。这里把两种口径的边界都钉住。
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveHasMore } = require('../manager/utils/pagination');

test('resolveHasMore：有 totalPages 时按页码判断', () => {
  assert.equal(resolveHasMore({ totalPages: 3 }, 1, 20, 20), true);
  assert.equal(resolveHasMore({ totalPages: 3 }, 2, 20, 20), true);
  assert.equal(resolveHasMore({ totalPages: 3 }, 3, 20, 20), false);
});

test('resolveHasMore：恰好一页满了也算没有下一页（旧实现的 bug）', () => {
  // 20 条正好等于 pageSize，totalPages=1 => 不应再翻页
  assert.equal(resolveHasMore({ totalPages: 1 }, 1, 20, 20), false);
});

test('resolveHasMore：后端没返回 totalPages 时退回按条数判断', () => {
  assert.equal(resolveHasMore(undefined, 1, 20, 20), true);
  assert.equal(resolveHasMore(null, 1, 19, 20), false);
  assert.equal(resolveHasMore({}, 2, 5, 20), false);
});

test('resolveHasMore：totalPages 非法值不参与判断', () => {
  assert.equal(resolveHasMore({ totalPages: 0 }, 1, 3, 20), false);
  assert.equal(resolveHasMore({ totalPages: 'abc' }, 1, 20, 20), true);
  assert.equal(resolveHasMore({ totalPages: '2' }, 1, 20, 20), true);
});
