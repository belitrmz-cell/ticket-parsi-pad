import type { PanelKey } from "@/lib/panel-icons.functions";

const DEFAULT_START: Record<PanelKey, string> = {
  admin: "/admin/login",
  director: "/director/dashboard",
  booth: "/",
  entry: "/",
};

/**
 * Head links/meta that make "Add to Home Screen" use the panel icon uploaded
 * in admin settings, and open the panel's own page (with its token).
 */
export function panelPwaHead(panel: PanelKey, startPath?: string) {
  const icon = `/api/public/panel-icon/${panel}`;
  const start = encodeURIComponent(startPath ?? DEFAULT_START[panel]);
  return {
    meta: [
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "manifest", href: `/api/public/manifest/${panel}?start=${start}` },
      { rel: "apple-touch-icon", href: icon },
      { rel: "icon", href: icon },
    ],
  };
}
