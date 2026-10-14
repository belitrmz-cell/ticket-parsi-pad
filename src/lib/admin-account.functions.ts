import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERSIAN_ERRORS } from "./account";

const KEY = "admin_recovery_email";

function anonClient() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  });
}

async function adminUser() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  if (!role) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
  return data.user;
}

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error(PERSIAN_ERRORS.notAdmin);
  return supabaseAdmin;
}

/** Admin sign-in runs on the server so the login works even when the database host is unreachable from the browser. */
export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    if (data.username.trim().toLowerCase() !== "admin") return { error: PERSIAN_ERRORS.invalidCredentials };
    const user = await adminUser();
    if (!user?.email) return { error: PERSIAN_ERRORS.invalidCredentials };
    const sb = await anonClient();
    const { data: s, error } = await sb.auth.signInWithPassword({ email: user.email, password: data.password });
    if (error || !s.session) return { error: PERSIAN_ERRORS.invalidCredentials };
    return { access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

export const getAdminRecoveryEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sa = await requireAdmin(context.userId);
    const { data } = await sa.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    return { email: data?.value ?? "" };
  });

export const setAdminRecoveryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().trim().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const sa = await requireAdmin(context.userId);
    const { error } = await sa.auth.admin.updateUserById(context.userId, { email: data.email, email_confirm: true });
    if (error) throw new Error("ثبت ایمیل ناموفق بود؛ شاید این ایمیل برای حساب دیگری ثبت شده باشد.");
    await sa.from("app_settings").upsert({ key: KEY, value: data.email }, { onConflict: "key" });
    return { ok: true };
  });

export const changeAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: z.string().min(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const sa = await requireAdmin(context.userId);
    const { error } = await sa.auth.admin.updateUserById(context.userId, { password: data.password });
    if (error) throw new Error("تغییر رمز ناموفق بود؛ رمز ساده‌تر از حد مجاز است.");
    return { ok: true };
  });

/** Sends a password-reset link to the saved recovery email. Never reveals the email itself. */
export const requestAdminRecovery = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    if (!row?.value) return { ok: false, reason: "no_email" as const };
    const sb = await anonClient();
    const { error } = await sb.auth.resetPasswordForEmail(row.value, { redirectTo: `${data.origin}/admin/reset` });
    if (error) return { ok: false, reason: "send_failed" as const };
    return { ok: true, reason: null };
  });
