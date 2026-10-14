// Routes browser calls to the cloud backend through this site's own server,
// so users on networks that block the backend host can still sign in.
export const SB_PROXY_PREFIX = "/api/public/sb";

if (typeof window !== "undefined" && !(window as unknown as { __sbProxy?: boolean }).__sbProxy) {
  (window as unknown as { __sbProxy?: boolean }).__sbProxy = true;
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const original = window.fetch.bind(window);
  if (base) {
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(base + "/")) {
        const target = window.location.origin + SB_PROXY_PREFIX + url.slice(base.length);
        if (input instanceof Request) return original(new Request(target, input), init);
        return original(target, init);
      }
      return original(input, init);
    };
  }
}
