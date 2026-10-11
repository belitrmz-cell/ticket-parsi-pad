import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A device counts as "online" if it pinged within this window. */
export const ONLINE_WINDOW_MS = 120_000;

const kindSchema = z.enum(["booth", "entry"]);

function onlineSince() {
  return new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
}

/* ---------------------------------- director side --------------------------------- */

export const listOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: rows }, { data: profile }, { data: settings }] = await Promise.all([
      context.supabase
        .from("operator_access")
        .select(
          "id,kind,device_id,device_label,operator_name,status,is_enabled,created_at,last_seen_at,director_id",
        )
        .eq("director_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("profiles")
        .select("booth_token,entry_token,max_booth_operators,max_entry_operators")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.from("app_settings").select("key,value").eq("key", "public_app_url"),
    ]);

    return {
      rows: rows ?? [],
      boothToken: profile?.booth_token ?? "",
      entryToken: profile?.entry_token ?? "",
      maxBooth: profile?.max_booth_operators ?? 3,
      maxEntry: profile?.max_entry_operators ?? 3,
      publicAppUrl: settings?.[0]?.value ?? "",
      onlineSince: onlineSince(),
    };
  });

export const setOperatorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "approved", "revoked"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: { status: "pending" | "approved" | "revoked"; session_token?: string } = {
      status: data.status,
    };
    // Revoking must kill live sessions: rotating the token invalidates them at once.
    if (data.status === "revoked") {
      patch.session_token = crypto.randomUUID().replace(/-/g, "");
    }
    const { error } = await context.supabase
      .from("operator_access")
      .update(patch)
      .eq("id", data.id)
      .eq("director_id", context.userId);
    if (error) throw new Error("به‌روزرسانی دسترسی ناموفق بود.");
    return { ok: true };
  });

export const setOperatorEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("operator_access")
      .update({ is_enabled: data.enabled })
      .eq("id", data.id)
      .eq("director_id", context.userId);
    if (error) throw new Error("به‌روزرسانی دسترسی ناموفق بود.");
    return { ok: true };
  });

export const setMaxOperators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ kind: kindSchema, max: z.number().int().min(1).max(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch =
      data.kind === "booth" ? { max_booth_operators: data.max } : { max_entry_operators: data.max };
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error("ذخیره محدودیت ناموفق بود.");
    return { ok: true };
  });

/* ----------------------------------- device side ---------------------------------- */

const deviceSchema = z.object({
  token: z.string().min(8),
  kind: kindSchema,
  deviceId: z.string().min(8).max(80),
});

async function directorForToken(kind: "booth" | "entry", token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const column = kind === "booth" ? "booth_token" : "entry_token";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,status,is_active,max_booth_operators,max_entry_operators")
    .eq(column, token)
    .maybeSingle();
  if (!data || !data.is_active || data.status !== "approved") return null;
  return { supabaseAdmin, profile: data };
}

export type DeviceState =
  | { state: "invalid" }
  | { state: "new"; directorName: string }
  | { state: "pending"; operatorName: string }
  | { state: "revoked"; operatorName: string }
  | { state: "disabled"; operatorName: string }
  | { state: "full"; operatorName: string }
  | { state: "approved"; operatorName: string; directorName: string; sessionToken: string };

/** Single source of truth for whether a device may use a booth/entry link right now. */
export const deviceStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => deviceSchema.parse(d))
  .handler(async ({ data }): Promise<DeviceState> => {
    const ctx = await directorForToken(data.kind, data.token);
    if (!ctx) return { state: "invalid" };
    const { supabaseAdmin, profile } = ctx;

    const { data: row } = await supabaseAdmin
      .from("operator_access")
      .select("id,operator_name,status,is_enabled,session_token")
      .eq("director_id", profile.id)
      .eq("kind", data.kind)
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (!row) return { state: "new", directorName: profile.full_name };
    if (row.status === "pending") return { state: "pending", operatorName: row.operator_name };
    if (row.status === "revoked") return { state: "revoked", operatorName: row.operator_name };
    if (!row.is_enabled) return { state: "disabled", operatorName: row.operator_name };

    const max =
      data.kind === "booth" ? profile.max_booth_operators : profile.max_entry_operators;
    const { count } = await supabaseAdmin
      .from("operator_access")
      .select("id", { count: "exact", head: true })
      .eq("director_id", profile.id)
      .eq("kind", data.kind)
      .eq("status", "approved")
      .eq("is_enabled", true)
      .neq("id", row.id)
      .gte("last_seen_at", onlineSince());
    if ((count ?? 0) >= max) return { state: "full", operatorName: row.operator_name };

    await supabaseAdmin
      .from("operator_access")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", row.id);

    return {
      state: "approved",
      operatorName: row.operator_name,
      directorName: profile.full_name,
      sessionToken: row.session_token,
    };
  });

export const requestAccess = createServerFn({ method: "POST" })
  .inputValidator((d) => deviceSchema.extend({ operatorName: z.string().min(2).max(60), deviceLabel: z.string().max(60).default("") }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await directorForToken(data.kind, data.token);
    if (!ctx) throw new Error("این لینک معتبر نیست.");
    const { supabaseAdmin, profile } = ctx;

    const { data: existing } = await supabaseAdmin
      .from("operator_access")
      .select("id,status")
      .eq("director_id", profile.id)
      .eq("kind", data.kind)
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "revoked") throw new Error("دسترسی این دستگاه لغو شده است.");
      await supabaseAdmin
        .from("operator_access")
        .update({
          operator_name: data.operatorName,
          device_label: data.deviceLabel,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return { ok: true };
    }

    const { error } = await supabaseAdmin.from("operator_access").insert({
      director_id: profile.id,
      kind: data.kind,
      device_id: data.deviceId,
      operator_name: data.operatorName,
      device_label: data.deviceLabel,
      status: "pending",
    });
    if (error) throw new Error("ارسال درخواست ناموفق بود.");
    return { ok: true };
  });
