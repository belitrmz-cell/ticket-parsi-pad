const KEY = "salon.device.id";

/** Stable per-browser identifier used for operator device approval. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

/** Short readable device/browser label for the director's operator list. */
export function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "مرورگر";
  const os = /Android/.test(ua)
    ? "اندروید"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Mac OS X/.test(ua)
        ? "مک"
        : /Windows/.test(ua)
          ? "ویندوز"
          : /Linux/.test(ua)
            ? "لینوکس"
            : "نامشخص";
  return `${browser} • ${os}`;
}
