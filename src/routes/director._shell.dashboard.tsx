import { createFileRoute, Link } from "@tanstack/react-router";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { DIRECTOR_SALE_LOCKED } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle, StatCard } from "@/components/AppShell";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { loadStats } from "@/lib/stats";
import { formatTime, money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "داشبورد | پنل کارگردان" },
      { name: "description", content: "آمار فروش و ورود بر اساس تاریخ و سانس." },
      { property: "og:title", content: "داشبورد کارگردان" },
      { property: "og:description", content: "آمار فروش و ورود بر اساس تاریخ و سانس." },
    ],
  }),
  component: DirectorDashboard,
});

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayRange(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d + 1).toISOString() };
}

function DirectorDashboard() {
  const { userId } = useAuth();
  const [day, setDay] = useState(() => localDateStr(new Date()));
  const [sessionId, setSessionId] = useState("");
  const range = dayRange(day);
  const sub = useSubscriptionStatus(userId);

  const sessions = useQuery({
    queryKey: ["dash-sessions", userId, day],
    queryFn: async () =>
      (
        await supabase
          .from("show_sessions")
          .select("id,starts_at,shows!inner(title,deleted_at)")
          .eq("director_id", userId!)
          .eq("is_active", true)
          .is("shows.deleted_at", null)
          .gte("starts_at", range.from)
          .lt("starts_at", range.to)
          .order("starts_at")
      ).data ?? [],
    enabled: !!userId,
  });

  const { data } = useQuery({
    queryKey: ["director-stats", userId, day, sessionId],
    queryFn: () =>
      loadStats({ directorId: userId, sessionId: sessionId || null, fromIso: range.from, toIso: range.to }),
    enabled: !!userId,
  });

  return (
    <>
      <PageTitle title="داشبورد" />
      {sub.data && !sub.data.active && (
        <div className="panel mb-4 space-y-3 border-primary/40 p-4">
          <p className="text-sm leading-7">{DIRECTOR_SALE_LOCKED}</p>
          <Button asChild size="sm"><Link to="/director/subscription">مشاهده و خرید اشتراک</Link></Button>
        </div>
      )}
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-semibold">تاریخ</label>
          <JalaliDatePicker
            value={day}
            onChange={(v) => {
              setDay(v ?? localDateStr(new Date()));
              setSessionId("");
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">انتخاب سانس</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">همه سانس‌ها</option>
            {(sessions.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.starts_at)} — {s.shows?.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="بلیت‌های فروخته‌شده" value={toFa(data?.ticketCount ?? 0)} />
        <StatCard label="صندلی خالی" value={toFa(data?.freeSeats ?? 0)} />
        <StatCard label="ظرفیت کل" value={toFa(data?.capacity ?? 0)} />
        <StatCard label="درآمد" value={money(data?.revenue ?? 0)} />
        <StatCard label="ورودهای ثبت‌شده" value={toFa(data?.entries ?? 0)} />
        <StatCard label="بلیت استفاده‌نشده" value={toFa(data?.unusedTickets ?? 0)} />
      </div>
    </>
  );
}
