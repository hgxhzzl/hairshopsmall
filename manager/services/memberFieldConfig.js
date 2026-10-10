const { request } = require('./_request');

const FEATURE_CONFIG_STORAGE_KEY = 'feature-config.member.add.local';
const FEATURE_CONFIG_URL = '/shops/feature-config';

const DEFAULT_VISIBILITY = {
  phone_number: true,
  member_no: true,
  birth_date: true,
  remark: true
};

/** 获取本地存储的字段可见性 */
function getStoredMemberFieldVisibility() {
  try {
    const raw = wx.getStorageSync(FEATURE_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

/** 保存字段可见性到服务器和本地 */
async function saveMemberFieldVisibility(token, visibilityState) {
  const payload = {
    version: 1,
    member: {
      phone_number: { visible: visibilityState.phone_number },
      member_no: { visible: visibilityState.member_no },
      birth_date: { visible: visibilityState.birth_date },
      remark: { visible: visibilityState.remark }
    }
  };

  await request(FEATURE_CONFIG_URL, {
    method: 'PUT',
    token,
    data: payload
  });

  try {
    wx.setStorageSync(FEATURE_CONFIG_STORAGE_KEY, JSON.stringify(visibilityState));
  } catch {
    // 存储失败不影响核心功能
  }
}

module.exports = { getStoredMemberFieldVisibility, saveMemberFieldVisibility };
