import { supabase } from "@/integrations/supabase/client";

export type StatsFilter = {
  directorId?: string | null;
  showId?: string | null;
  sessionId?: string | null;
  from?: string | null; // gregorian YYYY-MM-DD
  to?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
};

export type StatsResult = {
  ticketCount: number;
  soldSeats: number;
  freeSeats: number;
  capacity: number;
  revenue: number;
  entries: number;
  unusedTickets: number;
};

export async function loadStats(filter: StatsFilter): Promise<StatsResult> {
  let q = supabase.from("show_sessions").select("id,hall_id,starts_at").eq("is_active", true);
  if (filter.directorId) q = q.eq("director_id", filter.directorId);
  if (filter.showId) q = q.eq("show_id", filter.showId);
  if (filter.sessionId) q = q.eq("id", filter.sessionId);
  if (filter.from) q = q.gte("starts_at", `${filter.from}T00:00:00`);
  if (filter.to) q = q.lte("starts_at", `${filter.to}T23:59:59`);
  if (filter.fromIso) q = q.gte("starts_at", filter.fromIso);
  if (filter.toIso) q = q.lt("starts_at", filter.toIso);

  const { data: sessions } = await q;
  const list = sessions ?? [];
  const sessionIds = list.map((s) => s.id);
  const hallIds = Array.from(new Set(list.map((s) => s.hall_id)));

  const empty: StatsResult = {
    ticketCount: 0,
    soldSeats: 0,
    freeSeats: 0,
    capacity: 0,
    revenue: 0,
    entries: 0,
    unusedTickets: 0,
  };
  if (sessionIds.length === 0) return empty;

  const [{ data: tickets }, { data: entries }, { data: seats }] = await Promise.all([
    supabase.from("tickets").select("id,price,session_id").in("session_id", sessionIds),
    supabase.from("entries").select("id").in("session_id", sessionIds),
    supabase.from("seats").select("id,hall_id").in("hall_id", hallIds).eq("is_active", true),
  ]);

  const seatPerHall = new Map<string, number>();
  (seats ?? []).forEach((s) => seatPerHall.set(s.hall_id, (seatPerHall.get(s.hall_id) ?? 0) + 1));
  const capacity = list.reduce((sum, s) => sum + (seatPerHall.get(s.hall_id) ?? 0), 0);
  const ticketCount = tickets?.length ?? 0;
  const revenue = (tickets ?? []).reduce((sum, t) => sum + Number(t.price ?? 0), 0);
  const entryCount = entries?.length ?? 0;

  return {
    ticketCount,
    soldSeats: ticketCount,
    capacity,
    freeSeats: Math.max(capacity - ticketCount, 0),
    revenue,
    entries: entryCount,
    unusedTickets: Math.max(ticketCount - entryCount, 0),
  };
}
