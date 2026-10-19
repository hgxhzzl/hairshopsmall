const { request } = require('./_request');

/**
 * 获取仪表盘快照
 * 首页聚合口径已全部下移到后端 /dashboard/stats，
 * 客户端不再拉全表做聚合，只取一次结果。
 */
async function getDashboardSnapshot(token) {
  const response = await request('/dashboard/stats', { token });
  if (!response || response.success !== true || !response.data) {
    throw new Error('首页统计数据读取失败');
  }
  return response.data;
}

module.exports = { getDashboardSnapshot };
