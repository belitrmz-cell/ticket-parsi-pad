/** Username <-> internal email mapping (customers have no accounts; login is by username). */
export function emailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@salon.local`;
}

export const PERSIAN_ERRORS = {
  invalidCredentials: "نام کاربری یا رمز عبور نادرست است.",
  pending: "حساب شما هنوز توسط مدیر تأیید نشده است.",
  rejected: "درخواست ثبت‌نام شما رد شده است.",
  inactive: "حساب شما غیرفعال شده است.",
  notDirector: "این حساب دسترسی کارگردان ندارد.",
  notAdmin: "این حساب دسترسی مدیر ندارد.",
  duplicate: "این نام کاربری، ایمیل یا موبایل قبلاً ثبت شده است.",
  linkInvalid: "این لینک معتبر نیست.",
} as const;
