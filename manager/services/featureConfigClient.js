const { request } = require('./_request');

/**
 * 功能配置读写的共享底层模块。
 *
 * 收敛此前 featureConfig.js / memberFieldConfig.js / consumptionPayTypeConfig.js
 * 三处各自硬编码的 FEATURE_CONFIG_URL 与散落的 version:1，统一端点常量、
 * schema 版本与 PUT 逻辑。后端 mergeFeatureConfig 按 member/consumption/mine
 * 子树独立合并，故分次 PUT 各自子树互不覆盖，此处只负责注入 version。
 *
 * 该模块不依赖其他 config service，避免与被调用方形成循环 require。
 */

const FEATURE_CONFIG_URL = '/shops/feature-config';
const FEATURE_CONFIG_VERSION = 1;

/**
 * 写入功能配置：注入 schema version 后 PUT 指定子树片段。
 * @param {string} token
 * @param {{ member?: object, consumption?: object, mine?: object }} fragment 仅传需要更新的子树
 * @returns {Promise<object>} 接口响应
 */
async function putFeatureConfig(token, fragment) {
  return request(FEATURE_CONFIG_URL, {
    method: 'PUT',
    token,
    data: { version: FEATURE_CONFIG_VERSION, ...fragment }
  });
}

module.exports = { FEATURE_CONFIG_URL, FEATURE_CONFIG_VERSION, putFeatureConfig };
