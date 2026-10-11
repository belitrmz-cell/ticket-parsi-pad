import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authSchema = z.object({
  token: z.string().min(8),
  deviceId: z.string().min(8).max(80),
  sessionToken: z.string().min(8),
});
type BoothAuth = z.infer<typeof authSchema>;

async function authBooth(d: BoothAuth) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,status,is_active")
    .eq("booth_token", d.token)
    .maybeSingle();
  if (!profile || !profile.is_active || profile.status !== "approved") return null;
  const { data: access } = await supabaseAdmin
    .from("operator_access")
    .select("id,status,is_enabled,session_token,operator_name,print_size")
    .eq("director_id", profile.id)
    .eq("kind", "booth")
    .eq("device_id", d.deviceId)
    .maybeSingle();
  if (!access || access.status !== "approved" || !access.is_enabled || access.session_token !== d.sessionToken)
    return null;
  await supabaseAdmin.from("operator_access").update({ last_seen_at: new Date().toISOString() }).eq("id", access.id);
  return { supabaseAdmin, directorId: profile.id, access };
}

export const boothSessions = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    // Include recent past sessions so the show/date/session selectors stay
    // visible; the date picker still drives which day is sold.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 7);
    const { data: rows } = await a.supabaseAdmin
      .from("show_sessions")
      .select("id,starts_at,hall_id,show_id,shows(title,price,is_active),halls(name)")
      .eq("director_id", a.directorId)
      .eq("is_active", true)
      .gte("starts_at", since.toISOString())
      .order("starts_at")
      .limit(1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []).filter((r: any) => r.shows?.is_active !== false).map((r: any) => ({
      id: r.id as string,
      startsAt: r.starts_at as string,
      hallId: r.hall_id as string,
      showId: r.show_id as string,
      title: (r.shows?.title ?? "") as string,
      price: Number(r.shows?.price ?? 0),
      hallName: (r.halls?.name ?? "") as string,
    }));
  });

export const boothSeatMap = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.extend({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const db = a.supabaseAdmin;
    const { data: session } = await db
      .from("show_sessions")
      .select("id,hall_id")
      .eq("id", data.sessionId)
      .eq("director_id", a.directorId)
      .maybeSingle();
    if (!session) throw new Error("not found");
    const hallId = session.hall_id;
    const [rows, seats, objects, sold] = await Promise.all([
      db.from("hall_rows").select("id,label,x,y,order_index,price").eq("hall_id", hallId).order("order_index"),
      db.from("seats").select("id,row_id,number,x,y,is_active").eq("hall_id", hallId).gt("number", 0).order("number"),
      db.from("hall_objects").select("id,kind,label,x,y,width,height").eq("hall_id", hallId).eq("is_active", true),
      db.from("tickets").select("seat_id").eq("session_id", session.id).neq("status", "cancelled"),
    ]);
    return {
      rows: rows.data ?? [],
      seats: seats.data ?? [],
      objects: objects.data ?? [],
      soldSeatIds: (sold.data ?? []).map((t) => t.seat_id),
    };
  });

const PRINT_SIZES = ["standard", "narrow", "small"] as const;

export const boothGetPrintSize = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    return (PRINT_SIZES as readonly string[]).includes(a.access.print_size) ? a.access.print_size : "standard";
  });

export const boothSetPrintSize = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.extend({ size: z.enum(PRINT_SIZES) }).parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    await a.supabaseAdmin.from("operator_access").update({ print_size: data.size }).eq("id", a.access.id);
    return { ok: true };
  });

export const boothGetSwitch = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const { data: p } = await a.supabaseAdmin.from("profiles").select("session_switch_minutes").eq("id", a.directorId).single();
    return p?.session_switch_minutes ?? 60;
  });

export const boothSetSwitch = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.extend({ minutes: z.number().int().min(15).max(360) }).parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    await a.supabaseAdmin.from("profiles").update({ session_switch_minutes: data.minutes }).eq("id", a.directorId);
    return { ok: true };
  });

export type SoldTicket = {
  id: string; code: string; qrToken: string; serial: number; showTitle: string; hallName: string;
  rowLabel: string; seatNumber: number; startsAt: string; price: number;
};

export const boothSell = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    authSchema.extend({ sessionId: z.string().uuid(), seatIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const seatIds = Array.from(new Set(data.seatIds));
    const { data: txId, error } = await a.supabaseAdmin.rpc("booth_sell", {
      _director: a.directorId,
      _session: data.sessionId,
      _access: a.access.id,
      _operator: a.access.operator_name,
      _seats: seatIds,
    });
    if (error) {
      const m = error.message;
      if (m.includes("seat_sold") || m.includes("tickets_session_seat_unique"))
        return { ok: false as const, error: "یک یا چند صندلی همزمان فروخته شده است. نقشه را دوباره بررسی کنید." };
      if (m.includes("session_unavailable")) return { ok: false as const, error: "این سانس برای فروش فعال نیست." };
      if (m.includes("seat_invalid")) return { ok: false as const, error: "صندلی انتخاب‌شده معتبر نیست." };
      console.error("booth_sell", m);
      return { ok: false as const, error: "ثبت فروش ناموفق بود." };
    }
    const { data: tx } = await a.supabaseAdmin.from("transactions").select("serial,total_amount,created_at").eq("id", txId as string).single();
    const { data: rows } = await a.supabaseAdmin
      .from("tickets")
      .select("id,code,qr_token,serial,show_title,hall_name,row_label,seat_number,starts_at,price")
      .eq("transaction_id", txId as string)
      .order("row_label")
      .order("seat_number");
    const tickets: SoldTicket[] = (rows ?? []).map((t) => ({
      id: t.id, code: t.code, qrToken: t.qr_token, serial: Number(t.serial), showTitle: t.show_title,
      hallName: t.hall_name, rowLabel: t.row_label, seatNumber: t.seat_number, startsAt: t.starts_at, price: Number(t.price),
    }));
    return {
      ok: true as const,
      sale: {
        serial: Number(tx?.serial ?? 0),
        total: Number(tx?.total_amount ?? 0),
        createdAt: tx?.created_at ?? new Date().toISOString(),
        operatorName: a.access.operator_name,
        tickets,
      },
    };
  });

function normCode(raw: string) {
  const t = raw.trim();
  return (t.split(/[/?#]/).filter(Boolean).pop() ?? t).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const boothFindTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.extend({ code: z.string().min(4).max(400) }).parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const code = normCode(data.code);
    if (!code) return null;
    const { data: t } = await a.supabaseAdmin
      .from("tickets")
      .select("id,code,serial,show_title,hall_name,section_name,row_label,seat_number,starts_at,price,status")
      .eq("director_id", a.directorId)
      .or(`qr_token.eq.${code},code.eq.${code}`)
      .maybeSingle();
    if (!t) return null;
    const { count } = await a.supabaseAdmin.from("entries").select("id", { count: "exact", head: true }).eq("ticket_id", t.id);
    return { ...t, entered: (count ?? 0) > 0 };
  });

export const boothRefundTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.extend({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const db = a.supabaseAdmin;
    const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("ticket_id", data.ticketId);
    if ((count ?? 0) > 0) throw new Error("این بلیت قبلاً وارد سالن شده و قابل استرداد نیست");
    const rnd = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { data: upd } = await db
      .from("tickets")
      .update({ status: "cancelled", qr_token: rnd(24), code: rnd(6) })
      .eq("id", data.ticketId)
      .eq("director_id", a.directorId)
      .eq("status", "sold")
      .select("id");
    if (!upd?.length) throw new Error("بلیت پیدا نشد یا قبلاً مسترد شده است");
    return { ok: true };
  });

export const boothListTickets = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const { data: rows } = await a.supabaseAdmin
      .from("tickets")
      .select("id,code,qr_token,serial,show_title,hall_name,section_name,row_label,seat_number,starts_at,price,status,created_at,session_id,show_sessions(show_id),transactions(serial,operator_name),entries(entered_at)")
      .eq("director_id", a.directorId)
      .order("created_at", { ascending: false })
      .limit(2000);
    return rows ?? [];
  });

export const boothListRefunds = createServerFn({ method: "POST" })
  .inputValidator((d) => authSchema.parse(d))
  .handler(async ({ data }) => {
    const a = await authBooth(data);
    if (!a) throw new Error("unauthorized");
    const db = a.supabaseAdmin;
    const { data: rows } = await db
      .from("tickets")
      .select("id,serial,seat_id,session_id,show_title,hall_name,row_label,seat_number,starts_at,price,created_at,transactions(serial,operator_name,customer_name,customer_mobile)")
      .eq("director_id", a.directorId)
      .eq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(2000);
    const list = rows ?? [];
    const sessionIds = Array.from(new Set(list.map((r) => r.session_id)));
    const { data: active } = sessionIds.length
      ? await db.from("tickets").select("session_id,seat_id").in("session_id", sessionIds).neq("status", "cancelled")
      : { data: [] as { session_id: string; seat_id: string }[] };
    const taken = new Set((active ?? []).map((t) => `${t.session_id}:${t.seat_id}`));
    return list.map((r) => {
      const tx = (Array.isArray(r.transactions) ? r.transactions[0] : r.transactions) as
        | { serial: number; operator_name: string; customer_name: string; customer_mobile: string } | null;
      return {
        id: r.id, serial: Number(r.serial), showTitle: r.show_title, hallName: r.hall_name,
        rowLabel: r.row_label, seatNumber: r.seat_number, startsAt: r.starts_at, price: Number(r.price),
        soldAt: r.created_at, txSerial: Number(tx?.serial ?? 0), operator: tx?.operator_name ?? "",
        customerName: tx?.customer_name ?? "", customerMobile: tx?.customer_mobile ?? "",
        resold: taken.has(`${r.session_id}:${r.seat_id}`),
      };
    });
  });
