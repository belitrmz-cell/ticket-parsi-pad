import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PANEL_KEYS = ["admin", "director", "booth", "entry"] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];

/** Public: icons are non-sensitive images shown on every panel header. */
export const getPanelIcons = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key,value")
    .in("key", PANEL_KEYS.map((k) => `panel_icon_${k}`));
  const out: Partial<Record<PanelKey, string>> = {};
  for (const r of data ?? []) out[r.key.replace("panel_icon_", "") as PanelKey] = r.value;
  return out;
});

export const setPanelIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        panel: z.enum(PANEL_KEYS),
        // data URL (≤ ~400KB) or empty to reset
        value: z.string().max(600_000).refine((v) => v === "" || v.startsWith("data:image/")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = `panel_icon_${data.panel}`;
    if (data.value === "") await supabaseAdmin.from("app_settings").delete().eq("key", key);
    else await supabaseAdmin.from("app_settings").upsert({ key, value: data.value }, { onConflict: "key" });
    return { ok: true };
  });
