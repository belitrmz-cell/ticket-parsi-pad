import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadStats } from "@/lib/stats";
import { PageTitle, StatCard } from "@/components/AppShell";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { Label } from "@/components/ui/label";
import { formatJalaliDateTime, money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/admin/_shell/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [showId, setShowId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const { data: shows } = useQuery({
    queryKey: ["admin-shows-min"],
    queryFn: async () => (await supabase.from("shows").select("id,title").order("title")).data ?? [],
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-min", showId],
    queryFn: async () => {
      let q = supabase.from("show_sessions").select("id,starts_at").order("starts_at");
      if (showId) q = q.eq("show_id", showId);
      return (await q).data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", showId, sessionId, from, to],
    queryFn: () => loadStats({ showId, sessionId, from, to }),
  });

  return (
    <>
      <PageTitle title="داشبورد" />

      <div className="panel mb-6 grid gap-4 p-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>نمایش</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={showId ?? ""}
            onChange={(e) => {
              setShowId(e.target.value || null);
              setSessionId(null);
            }}
          >
            <option value="">همه نمایش‌ها</option>
            {(shows ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>سانس</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={sessionId ?? ""}
            onChange={(e) => setSessionId(e.target.value || null)}
          >
            <option value="">همه سانس‌ها</option>
            {(sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {formatJalaliDateTime(s.starts_at)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>از تاریخ</Label>
          <JalaliDatePicker value={from} onChange={setFrom} clearable />
        </div>
        <div className="space-y-2">
          <Label>تا تاریخ</Label>
          <JalaliDatePicker value={to} onChange={setTo} clearable />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="بلیت فروخته‌شده" value={toFa(stats?.ticketCount ?? 0)} />
        <StatCard label="صندلی فروخته‌شده" value={toFa(stats?.soldSeats ?? 0)} />
        <StatCard label="صندلی آزاد" value={toFa(stats?.freeSeats ?? 0)} />
        <StatCard label="مبلغ فروش" value={money(stats?.revenue ?? 0)} />
        <StatCard label="ورودهای ثبت‌شده" value={toFa(stats?.entries ?? 0)} />
        <StatCard label="بلیت‌های استفاده‌نشده" value={toFa(stats?.unusedTickets ?? 0)} />
      </div>
    </>
  );
}
