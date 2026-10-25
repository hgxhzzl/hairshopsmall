/**
 * 列表分页的公共判断。
 *
 * 之前消费/充值两个列表页用 `rows.length >= pageSize` 判断是否还有下一页，
 * 当总条数正好是 pageSize 的整数倍时，会多发一次必定为空请求。
 * 后端分页结构里已经带了 totalPages，优先用它；只有后端没返回时才退回按条数判断
 * （兼容老接口，避免一处改动把列表卡死无法翻页）。
 */

/**
 * @param {object|null|undefined} pagination 后端返回的 pagination
 * @param {number} page 当前已加载到的页码
 * @param {number} rowCount 本次返回的条数
 * @param {number} pageSize 每页条数
 * @returns {boolean} 是否还有下一页
 */
function resolveHasMore(pagination, page, rowCount, pageSize) {
  const totalPages = Number(pagination && pagination.totalPages);

  if (Number.isFinite(totalPages) && totalPages > 0) {
    return page < totalPages;
  }

  return rowCount >= pageSize;
}

module.exports = { resolveHasMore };
