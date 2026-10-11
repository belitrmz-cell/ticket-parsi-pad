import { createFileRoute } from "@tanstack/react-router";
import { PANEL_KEYS, type PanelKey } from "@/lib/panel-icons.functions";

const PANEL_NAMES: Record<PanelKey, string> = {
  admin: "پنل مدیریت | سامانه بلیت",
  director: "پنل کارگردان | سامانه بلیت",
  booth: "باجه فروش بلیت | سامانه بلیت",
  entry: "کنترل ورود | سامانه بلیت",
};

export const Route = createFileRoute("/api/public/manifest/$panel")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const panel = params.panel as PanelKey;
        if (!PANEL_KEYS.includes(panel)) return new Response("Not found", { status: 404 });

        const icon = `/api/public/panel-icon/${panel}`;
        const manifest = {
          name: PANEL_NAMES[panel],
          short_name: PANEL_NAMES[panel].split(" | ")[0],
          // "." resolves to the page the manifest was added from, so each
          // panel's shared link (including its token) stays the start URL.
          start_url: ".",
          scope: ".",
          display: "standalone",
          dir: "rtl",
          lang: "fa",
          background_color: "#1c1410",
          theme_color: "#1c1410",
          icons: [
            { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
