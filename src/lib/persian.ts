// Persian digits, Jalali calendar helpers. All user-facing dates are Jalali.

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

export function faToEn(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function money(amount: number): string {
  return toFa(new Intl.NumberFormat("en-US").format(Math.round(amount || 0))) + " تومان";
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const WEEK_DAYS = ["شنبه", "یک‌شنبه", "دو‌شنبه", "سه‌شنبه", "چهار‌شنبه", "پنج‌شنبه", "جمعه"];
export const WEEK_DAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function div(a: number, b: number) {
  return Math.floor(a / b);
}

/** Gregorian -> Jalali (jalaali-js algorithm) */
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days =
    365 * gy2 +
    div(gy3 + 3, 4) -
    div(gy3 + 99, 100) +
    div(gy3 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/** Jalali -> Gregorian */
export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600;
  const jy2 = jy <= 979 ? jy : jy - 979;
  let days =
    365 * jy2 +
    div(jy2, 33) * 8 +
    div((jy2 % 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]!; gm++) gd -= sal_a[gm]!;
  return [gy, gm, gd];
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // esfand
  const [gy] = toGregorian(jy + 1, 1, 1);
  const [, , gd] = toGregorian(jy, 12, 30);
  void gy;
  void gd;
  return isJalaliLeap(jy) ? 30 : 29;
}

export function isJalaliLeap(jy: number): boolean {
  const r = ((jy - (jy > 0 ? 474 : 473)) % 2820) + 474;
  return ((r + 38) * 682) % 2816 < 682;
}

/** ISO string / Date -> Jalali date parts in local time */
export function jalaliParts(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const [jy, jm, jd] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return { jy, jm, jd, hour: d.getHours(), minute: d.getMinutes(), weekday: (d.getDay() + 1) % 7 };
}

export function formatJalaliDate(input: string | Date): string {
  const { jy, jm, jd } = jalaliParts(input);
  return toFa(`${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
}

export function formatJalaliLong(input: string | Date): string {
  const { jy, jm, jd, weekday } = jalaliParts(input);
  return `${WEEK_DAYS[weekday]} ${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}

export function formatTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return toFa(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
}

export function formatJalaliDateTime(input: string | Date): string {
  return `${formatJalaliDate(input)} - ${formatTime(input)}`;
}

/** "YYYY-MM-DD" gregorian date string -> jalali display */
export function dateStrToJalali(s: string): string {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  const [jy, jm, jd] = toJalali(y, m, d);
  return toFa(`${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
}

export function todayJalali(): { jy: number; jm: number; jd: number } {
  const now = new Date();
  const [jy, jm, jd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { jy, jm, jd };
}

/** Jalali parts -> "YYYY-MM-DD" gregorian string */
export function jalaliToDateStr(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}
