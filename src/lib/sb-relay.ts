// Rewrites browser requests aimed at the backend domain to the site's own
// /api/public/sb relay, so blocked networks can still use admin/director panels.
let installed = false;

export function installBackendRelay() {
  if (installed || typeof window === "undefined") return;
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  if (!base) return;
  installed = true;
  const original = window.fetch.bind(window);
  const relay = `${window.location.origin}/api/public/sb`;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(base + "/")) {
      const next = relay + url.slice(base.length);
      if (input instanceof Request) return original(new Request(next, input), init);
      return original(next, init);
    }
    return original(input, init);
  };
}

installBackendRelay();
