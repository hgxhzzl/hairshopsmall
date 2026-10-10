const { request } = require('./_request');

const FEATURE_CONFIG_STORAGE_KEY = 'feature-config.consumption.pay-type.local';
const FEATURE_CONFIG_URL = '/shops/feature-config';

const DEFAULT_VISIBILITY = { '现金': true, '账户': true, '服务': true };
const DEFAULT_USAGE_PRICE = { '现金': 'normal_price', '账户': 'member_price', '服务': 'member_price' };

function getStoredConsumptionPayTypeSettings() {
  try {
    const raw = wx.getStorageSync(FEATURE_CONFIG_STORAGE_KEY);
    if (!raw) return { visibility: { ...DEFAULT_VISIBILITY }, usagePrice: { ...DEFAULT_USAGE_PRICE } };
    const parsed = JSON.parse(raw);
    const consumption = parsed.consumption || {};
    const payType = consumption.pay_type || {};
    const usagePrice = consumption.usage_price || {};
    return {
      visibility: {
        '现金': payType['现金'] && payType['现金'].visible !== undefined ? payType['现金'].visible : DEFAULT_VISIBILITY['现金'],
        '账户': payType['账户'] && payType['账户'].visible !== undefined ? payType['账户'].visible : DEFAULT_VISIBILITY['账户'],
        '服务': payType['服务'] && payType['服务'].visible !== undefined ? payType['服务'].visible : DEFAULT_VISIBILITY['服务']
      },
      usagePrice: {
        '现金': usagePrice['现金'] || DEFAULT_USAGE_PRICE['现金'],
        '账户': usagePrice['账户'] || DEFAULT_USAGE_PRICE['账户'],
        '服务': usagePrice['服务'] || DEFAULT_USAGE_PRICE['服务']
      }
    };
  } catch {
    return { visibility: { ...DEFAULT_VISIBILITY }, usagePrice: { ...DEFAULT_USAGE_PRICE } };
  }
}

async function saveConsumptionPayTypeSettings(token, settingsState) {
  const payload = {
    version: 1,
    consumption: {
      pay_type: {
        '现金': { visible: settingsState.visibility['现金'] },
        '账户': { visible: settingsState.visibility['账户'] },
        '服务': { visible: settingsState.visibility['服务'] }
      },
      usage_price: {
        '现金': settingsState.usagePrice['现金'],
        '账户': settingsState.usagePrice['账户'],
        '服务': settingsState.usagePrice['服务']
      }
    }
  };
  await request(FEATURE_CONFIG_URL, { method: 'PUT', token, data: payload });
  try { wx.setStorageSync(FEATURE_CONFIG_STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

module.exports = { getStoredConsumptionPayTypeSettings, saveConsumptionPayTypeSettings };
