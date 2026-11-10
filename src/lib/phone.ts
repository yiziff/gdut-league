/** 去掉空格、横线和 +86 前缀；不是大陆手机号就返回空字符串。 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s-]/g, '').replace(/^(\+?86)/, '');
  return /^1[3-9]\d{9}$/.test(digits) ? digits : '';
}

export function maskPhone(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone;
}
