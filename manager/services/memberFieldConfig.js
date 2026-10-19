const { putFeatureConfig } = require('./featureConfigClient');

const FEATURE_CONFIG_STORAGE_KEY = 'feature-config.member.add.local';

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
  const member = {
    phone_number: { visible: visibilityState.phone_number },
    member_no: { visible: visibilityState.member_no },
    birth_date: { visible: visibilityState.birth_date },
    remark: { visible: visibilityState.remark }
  };

  await putFeatureConfig(token, { member });

  try {
    wx.setStorageSync(FEATURE_CONFIG_STORAGE_KEY, JSON.stringify(visibilityState));
  } catch {
    // 存储失败不影响核心功能
  }
}

/**
 * 将服务端返回的 member 子树回填到本地存储。
 * remoteMember 形如 { phone_number: { visible }, member_no: { visible }, ... }
 */
function applyRemoteMemberVisibility(remoteMember) {
  if (!remoteMember || typeof remoteMember !== 'object') return;
  const pick = (key) => {
    const node = remoteMember[key];
    return node && typeof node === 'object' && node.visible !== undefined
      ? !!node.visible
      : DEFAULT_VISIBILITY[key];
  };
  const visibilityState = {
    phone_number: pick('phone_number'),
    member_no: pick('member_no'),
    birth_date: pick('birth_date'),
    remark: pick('remark')
  };
  try {
    wx.setStorageSync(FEATURE_CONFIG_STORAGE_KEY, JSON.stringify(visibilityState));
  } catch {
    // 存储失败不影响核心功能
  }
}

module.exports = { getStoredMemberFieldVisibility, saveMemberFieldVisibility, applyRemoteMemberVisibility };
