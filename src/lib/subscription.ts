import { toFa } from "@/lib/persian";

export type SubKind = "daily" | "monthly";

export const DIRECTOR_SALE_LOCKED =
  "فروش بلیت برای این پنل فعال نیست. برای فعال‌سازی فروش، اشتراک مناسب را انتخاب و درخواست خرید خود را ثبت کنید. پس از پرداخت کارت‌به‌کارت و تأیید مدیر سامانه، فروش برای مدت اشتراک فعال خواهد شد.";

export function kindLabel(k: string) {
  return k === "daily" ? "روزانه" : "ماهانه";
}

export function durationLabel(kind: string, n: number) {
  return `${toFa(n)} ${kind === "daily" ? "روز" : "ماه"}`;
}

export type SubRequest = {
  status: string;
  starts_at: string | null;
  ends_at: string | null;
};

/** Display status derived from the stored request; expiry is time-based. */
export function requestState(r: SubRequest, now = Date.now()) {
  if (r.status === "pending") return { key: "pending", label: "در انتظار تأیید مدیر" };
  if (r.status === "rejected") return { key: "rejected", label: "رد شده" };
  const end = r.ends_at ? new Date(r.ends_at).getTime() : 0;
  const start = r.starts_at ? new Date(r.starts_at).getTime() : 0;
  if (end <= now) return { key: "expired", label: "اشتراک منقضی‌شده" };
  if (start > now) return { key: "scheduled", label: "تأییدشده (شروع پس از اشتراک فعلی)" };
  return { key: "active", label: "اشتراک فعال" };
}

export function rpcError(msg: string) {
  if (msg.includes("pending_exists")) return "یک درخواست در انتظار تأیید دارید.";
  if (msg.includes("plan_unavailable")) return "این اشتراک دیگر فعال نیست.";
  if (msg.includes("not_pending")) return "این درخواست قبلاً بررسی شده است.";
  if (msg.includes("forbidden")) return "دسترسی ندارید.";
  return "عملیات انجام نشد.";
}
