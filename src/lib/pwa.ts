import type { PanelKey } from "@/lib/panel-icons.functions";

/**
 * Head links/meta that make "Add to Home Screen" use the panel icon uploaded
 * in admin settings. The icon URL is stable; the server route behind it always
 * serves the latest uploaded image.
 */
export function panelPwaHead(panel: PanelKey) {
  const icon = `/api/public/panel-icon/${panel}`;
  return {
    meta: [
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "manifest", href: `/api/public/manifest/${panel}` },
      { rel: "apple-touch-icon", href: icon },
      { rel: "icon", href: icon },
    ],
  };
}
