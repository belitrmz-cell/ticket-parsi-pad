import { createFileRoute } from "@tanstack/react-router";
import { PANEL_KEYS, type PanelKey } from "@/lib/panel-icons.functions";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1]!;
  const base64 = match[2]!;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType };
}

export const Route = createFileRoute("/api/public/panel-icon/$panel")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const panel = params.panel as PanelKey;
        if (!PANEL_KEYS.includes(panel)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", `panel_icon_${panel}`)
          .maybeSingle();

        const parsed = data?.value ? dataUrlToBytes(data.value) : null;
        if (!parsed) {
          // No custom icon uploaded yet — fall back to the site favicon.
          return new Response(null, {
            status: 302,
            headers: { Location: "/favicon.ico", "Cache-Control": "no-cache" },
          });
        }

        return new Response(parsed.bytes, {
          headers: {
            "Content-Type": parsed.contentType,
            // Short cache so a newly uploaded icon shows up quickly.
            "Cache-Control": "public, max-age=60",
          },
        });
      },
    },
  },
});
