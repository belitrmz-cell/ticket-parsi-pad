import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Auth payload every entry-device call must carry. */
const deviceAuthSchema = z.object({
  token: z.string().min(8),
  deviceId: z.string().min(8).max(80),
  sessionToken: z.string().min(8),
});

type DeviceAuth = z.infer<typeof deviceAuthSchema>;

async function authDevice(d: DeviceAuth) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,status,is_active,session_switch_minutes")
    .eq("entry_token", d.token)
    .maybeSingle();
  if (!profile || !profile.is_active || profile.status !== "approved") return null;

  const { data: access } = await supabaseAdmin
    .from("operator_access")
    .select("id,operator_name,status,is_enabled,session_token")
    .eq("director_id", profile.id)
    .eq("kind", "entry")
    .eq("device_id", d.deviceId)
    .maybeSingle();
  if (
    !access ||
    access.status !== "approved" ||
    !access.is_enabled ||
    access.session_token !== d.sessionToken
  )
    return null;

  await supabaseAdmin
    .from("operator_access")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", access.id);

  return { supabaseAdmin, profile, access };
}

export type ScannedTicket = {
  id: string;
  code: string;
  serial: number;
  showTitle: string;
  hallName: string;
  sectionName: string;
  rowLabel: string;
  seatNumber: number;
  startsAt: string;
  price: number;
  sessionId: string;
};

export type ScanResult =
  | { result: "unauthorized" }
  | { result: "no_session" }
  | { result: "notfound" }
  | { result: "cancelled"; ticket: ScannedTicket }
  | { result: "wrong_session"; ticket: ScannedTicket }
  | { result: "duplicate"; ticket: ScannedTicket; enteredAt: string; operatorName: string }
  | { result: "ok"; ticket: ScannedTicket; enteredAt: string };

/** Accepts a raw QR payload, a full ticket URL, or a short ticket code. */
function normalizeCode(raw: string): string {
  const trimmed = raw.trim();
  const last = trimmed.split(/[/?#]/).filter(Boolean).pop() ?? trimmed;
  return last.toLowerCase();
}

type TicketRow = {
  id: string;
  code: string;
  serial: number;
  show_title: string;
  hall_name: string;
  section_name: string;
  row_label: string;
  seat_number: number;
  starts_at: string;
  price: number;
  session_id: string;
  status: string;
};

const TICKET_COLUMNS =
  "id,code,serial,show_title,hall_name,section_name,row_label,seat_number,starts_at,price,session_id,status";

function toTicket(t: TicketRow): ScannedTicket {
  return {
    id: t.id,
    code: t.code,
    serial: t.serial,
    showTitle: t.show_title,
    hallName: t.hall_name,
    sectionName: t.section_name,
    rowLabel: t.row_label,
    seatNumber: t.seat_number,
    startsAt: t.starts_at,
    price: t.price,
    sessionId: t.session_id,
  };
}

/** Registers an entry for a scanned/typed ticket and reports what happened. */
export const scanEntry = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    deviceAuthSchema
      .extend({
        code: z.string().min(4).max(400),
        sessionId: z.string().uuid().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const ctx = await authDevice(data);
    if (!ctx) return { result: "unauthorized" };
    const { supabaseAdmin, profile, access } = ctx;
    if (!data.sessionId) return { result: "no_session" };

    const code = normalizeCode(data.code);

    const { data: rows } = await supabaseAdmin
      .from("tickets")
      .select(TICKET_COLUMNS)
      .eq("director_id", profile.id)
      .or(`qr_token.eq.${code},code.eq.${code}`)
      .limit(1);

    const row = (rows?.[0] ?? null) as TicketRow | null;
    if (!row) return { result: "notfound" };
    const ticket = toTicket(row);

    if (row.status !== "sold") return { result: "cancelled", ticket };
    if (data.sessionId !== row.session_id) return { result: "wrong_session", ticket };

    const { data: prior } = await supabaseAdmin
      .from("entries")
      .select("entered_at,operator_name")
      .eq("ticket_id", row.id)
      .order("entered_at", { ascending: true })
      .limit(1);

    const first = prior?.[0];
    if (first)
      return {
        result: "duplicate",
        ticket,
        enteredAt: first.entered_at,
        operatorName: first.operator_name,
      };

    const enteredAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from("entries").insert({
      ticket_id: row.id,
      director_id: profile.id,
      session_id: row.session_id,
      operator_name: access.operator_name,
      entered_at: enteredAt,
    });
    if (error) {
      // Unique/race fallback: someone else registered the same ticket first.
      const { data: again } = await supabaseAdmin
        .from("entries")
        .select("entered_at,operator_name")
        .eq("ticket_id", row.id)
        .limit(1);
      const dup = again?.[0];
      if (dup)
        return {
          result: "duplicate",
          ticket,
          enteredAt: dup.entered_at,
          operatorName: dup.operator_name,
        };
      throw new Error("ثبت ورود ناموفق بود.");
    }

    return { result: "ok", ticket, enteredAt };
  });

export type EntryFeed = {
  sessions: { id: string; title: string; startsAt: string; hallName: string }[];
  entries: {
    id: string;
    enteredAt: string;
    operatorName: string;
    showTitle: string;
    rowLabel: string;
    seatNumber: number;
    sectionName: string;
    code: string;
  }[];
  todayCount: number; switchMinutes: number;
};

/** Today's sessions plus the most recent entries, for the scanner screen. */
export const entryFeed = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    deviceAuthSchema
      .extend({ dayStart: z.string().datetime().optional(), dayEnd: z.string().datetime().optional() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<EntryFeed> => {
    const ctx = await authDevice(data);
    if (!ctx) return { sessions: [], entries: [], todayCount: 0, switchMinutes: 60 };
    const { supabaseAdmin, profile } = ctx;

    let dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    let dayEnd = new Date(dayStart.getTime() + 86_400_000);
    if (data.dayStart && data.dayEnd) {
      dayStart = new Date(data.dayStart);
      dayEnd = new Date(data.dayEnd);
    }

    const [{ data: sessions }, { data: entries }, { count }] = await Promise.all([
      supabaseAdmin
        .from("show_sessions")
        .select("id,starts_at,shows(title),halls(name)")
        .eq("director_id", profile.id)
        .eq("is_active", true)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at", { ascending: true }),
      supabaseAdmin
        .from("entries")
        .select("id,entered_at,operator_name,tickets(show_title,row_label,seat_number,section_name,code)")
        .eq("director_id", profile.id)
        .order("entered_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("director_id", profile.id)
        .gte("entered_at", dayStart.toISOString()),
    ]);

    return {
      sessions: (sessions ?? []).map((s) => ({
        id: s.id,
        startsAt: s.starts_at,
        title: (s.shows as { title: string } | null)?.title ?? "",
        hallName: (s.halls as { name: string } | null)?.name ?? "",
      })),
      entries: (entries ?? []).map((e) => {
        const t = e.tickets as {
          show_title: string;
          row_label: string;
          seat_number: number;
          section_name: string;
          code: string;
        } | null;
        return {
          id: e.id,
          enteredAt: e.entered_at,
          operatorName: e.operator_name,
          showTitle: t?.show_title ?? "",
          rowLabel: t?.row_label ?? "",
          seatNumber: t?.seat_number ?? 0,
          sectionName: t?.section_name ?? "",
          code: t?.code ?? "",
        };
      }),
      todayCount: count ?? 0, switchMinutes: profile.session_switch_minutes ?? 60,
    };
  });
