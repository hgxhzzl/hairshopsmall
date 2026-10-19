const { request } = require('./_request');
const { FEATURE_CONFIG_URL } = require('./featureConfigClient');
const { applyRemoteMemberVisibility } = require('./memberFieldConfig');
const { applyRemoteConsumptionSettings } = require('./consumptionPayTypeConfig');

/**
 * 登录后从服务端拉取功能配置并回填本地缓存。
 * 解决「配置只写本地、从不读回服务器」导致换设备/重装后配置丢失的问题。
 * 失败时静默降级为本地缓存，不阻断登录流程。
 */
async function syncFeatureConfigFromServer(token) {
  try {
    const res = await request(FEATURE_CONFIG_URL, { token });
    const config = res && res.data && res.data.config ? res.data.config : null;
    if (!config) return false;

    if (config.member) applyRemoteMemberVisibility(config.member);
    if (config.consumption) applyRemoteConsumptionSettings(config.consumption);
    return true;
  } catch {
    // 网络/接口异常时保留本地配置
    return false;
  }
}

module.exports = { syncFeatureConfigFromServer };
