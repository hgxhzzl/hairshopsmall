/**
 * 会员新增 / 编辑表单的共享纯逻辑。
 *
 * member/add 与 member/edit 原先各自维护一套近乎相同的字段长度限制、输入清洗、
 * 提交门禁、校验与 payload 构造（约百行）。收敛到这里，改一处校验即可两页同步生效。
 */

const MEMBER_ID_MAX_LENGTH = 6;
const MEMBER_NAME_MAX_LENGTH = 10;
const REMARK_MAX_LENGTH = 20;
const PHONE_REGEX = /^1[3-9]\d{9}$/;

/** 姓名：截断到最大长度 */
function sanitizeName(value) {
  return (value || '').slice(0, MEMBER_NAME_MAX_LENGTH);
}

/** 会员编号：仅数字，截断到最大长度 */
function sanitizeMemberNo(value) {
  return (value || '').replace(/\D/g, '').slice(0, MEMBER_ID_MAX_LENGTH);
}

/** 手机号：仅数字，最多 11 位 */
function sanitizePhone(value) {
  return (value || '').replace(/\D/g, '').slice(0, 11);
}

/** 备注：截断到最大长度 */
function sanitizeRemark(value) {
  return (value || '').slice(0, REMARK_MAX_LENGTH);
}

/** 提交门禁：姓名与注册日期必填，手机号若填则需合法 */
function canSubmitForm({ memberName, phone, registerDate }) {
  const nameOk = !!(memberName || '').trim();
  const registerOk = !!(registerDate || '').trim();
  const phoneOk = !(phone || '').trim() || PHONE_REGEX.test(phone);
  return !!(nameOk && registerOk && phoneOk);
}

/** 提交前校验：返回错误文案，通过则返回空串 */
function validateMemberForm({ memberName, phone, registerDate }) {
  if (!(memberName || '').trim()) return '请输入会员姓名';
  if ((phone || '').trim() && !PHONE_REGEX.test(phone)) return '手机号码格式不正确';
  if (!(registerDate || '').trim()) return '请选择注册日期';
  return '';
}

/** 构造后端 payload（空串字段按 undefined 省略） */
function buildMemberPayload({ memberName, phone, memberNo, gender, birthDate, registerDate, remark }) {
  return {
    member_name: memberName.trim(),
    member_no: (memberNo || '').trim() || undefined,
    phone_number: (phone || '').trim() || undefined,
    gender,
    birth_date: birthDate || undefined,
    register_time: new Date(registerDate + 'T00:00:00').toISOString(),
    remark: (remark || '').trim() || undefined
  };
}

/** 详情对象（normalizeMemberDetail 结果）→ 可编辑表单字段 */
function memberToForm(member) {
  return {
    memberName: sanitizeName(member.name || ''),
    memberNo: sanitizeMemberNo(member.memberNo || ''),
    phone: sanitizePhone(member.phone || ''),
    gender: member.gender === '女' ? '女' : '男',
    birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
    registerDate: member.registerTime ? member.registerTime.slice(0, 10) : '',
    remark: sanitizeRemark(member.remark || '')
  };
}

module.exports = {
  MEMBER_ID_MAX_LENGTH,
  MEMBER_NAME_MAX_LENGTH,
  REMARK_MAX_LENGTH,
  PHONE_REGEX,
  sanitizeName,
  sanitizeMemberNo,
  sanitizePhone,
  sanitizeRemark,
  canSubmitForm,
  validateMemberForm,
  buildMemberPayload,
  memberToForm
};
