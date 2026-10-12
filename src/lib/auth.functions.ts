import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailForUsername, PERSIAN_ERRORS } from "./account";

const ADMIN_USERNAME = "Admin";
// The backend rejects passwords under 6 chars or known-weak ones.
const ADMIN_PASSWORD = "Salon#Admin2026";

/** Creates the default Admin account once, and returns the fixed director link token. */
export const bootstrapSystem = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", ADMIN_USERNAME)
    .maybeSingle();

  if (!existing) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailForUsername(ADMIN_USERNAME),
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error && !error.message.includes("already")) throw new Error(error.message);
    let userId = created?.user?.id;
    if (!userId) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === emailForUsername(ADMIN_USERNAME))?.id;
    }
    if (userId) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        username: ADMIN_USERNAME,
        full_name: "مدیر سامانه",
        email: emailForUsername(ADMIN_USERNAME),
        status: "approved",
        is_active: true,
      });
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    }
  }

  return { ok: true };
});

export const getDirectorLinkToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error(PERSIAN_ERRORS.notAdmin);
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("key,value")
      .in("key", ["director_link_token", "public_app_url"]);
    const get = (k: string) => data?.find((r) => r.key === k)?.value ?? "";
    return { token: get("director_link_token"), publicAppUrl: get("public_app_url") };
  });

/** Admin-configurable public base URL used to build shareable links. */
export const setPublicAppUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().or(z.literal("")) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const value = data.url.replace(/\/+$/, "");
    await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "public_app_url", value }, { onConflict: "key" });
    return { ok: true, url: value };
  });


export const checkDirectorLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "director_link_token")
      .maybeSingle();
    return { valid: row?.value === data.token };
  });

const registerSchema = z.object({
  token: z.string().min(8),
  full_name: z.string().min(3),
  mobile: z.string().min(10),
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(6),
});

export const registerDirector = createServerFn({ method: "POST" })
  .inputValidator((d) => registerSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "director_link_token")
      .maybeSingle();
    if (setting?.value !== data.token) throw new Error(PERSIAN_ERRORS.linkInvalid);

    const { data: dup } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(
        `username.eq.${data.username},email.eq.${data.email.toLowerCase()},mobile.eq.${data.mobile}`,
      )
      .maybeSingle();
    if (dup) throw new Error(PERSIAN_ERRORS.duplicate);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailForUsername(data.username),
      password: data.password,
      email_confirm: true,
    });
    if (error || !created?.user) throw new Error(PERSIAN_ERRORS.duplicate);

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: data.username,
      full_name: data.full_name,
      mobile: data.mobile,
      email: data.email.toLowerCase(),
      status: "pending",
      is_active: true,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "director" });
    return { ok: true };
  });

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error(PERSIAN_ERRORS.notAdmin);
  return supabaseAdmin;
}

export const setDirectorState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        directorId: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const patch: { status?: "pending" | "approved" | "rejected"; is_active?: boolean } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.isActive === "boolean") patch.is_active = data.isActive;
    if (Object.keys(patch).length === 0) return { ok: true };

    await supabaseAdmin.from("profiles").update(patch).eq("id", data.directorId);

    const blocked = data.status === "rejected" || data.isActive === false;
    const unblocked = data.isActive === true || data.status === "approved";
    if (blocked) {
      // invalidate every active session immediately
      await supabaseAdmin.auth.admin.updateUserById(data.directorId, { ban_duration: "876000h" });
    } else if (unblocked) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("status,is_active")
        .eq("id", data.directorId)
        .maybeSingle();
      if (profile?.status === "approved" && profile.is_active) {
        await supabaseAdmin.auth.admin.updateUserById(data.directorId, { ban_duration: "none" });
      }
    }
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ directorId: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.directorId, {
      password: data.password,
    });
    if (error) throw new Error("تغییر رمز عبور ناموفق بود.");
    return { ok: true };
  });
