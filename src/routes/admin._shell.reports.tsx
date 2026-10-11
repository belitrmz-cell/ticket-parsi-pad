import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, StatCard } from "@/components/AppShell";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { Label } from "@/components/ui/label";
import { loadStats } from "@/lib/stats";
import { money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/admin/_shell/reports")({
  component: AdminReports,
});

function AdminReports() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const { data: overall } = useQuery({
    queryKey: ["admin-report-overall", from, to],
    queryFn: () => loadStats({ from, to }),
  });

  const { data: perShow } = useQuery({
    queryKey: ["admin-report-shows", from, to],
    queryFn: async () => {
      const { data: shows } = await supabase.from("shows").select("id,title");
      const rows = await Promise.all(
        (shows ?? []).map(async (s) => ({
          title: s.title,
          stats: await loadStats({ showId: s.id, from, to }),
        })),
      );
      return rows.filter((r) => r.stats.ticketCount > 0);
    },
  });

  return (
    <>
      <PageTitle title="گزارش‌ها" />
      <div className="panel mb-6 grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>از تاریخ</Label>
          <JalaliDatePicker value={from} onChange={setFrom} clearable />
        </div>
        <div className="space-y-2">
          <Label>تا تاریخ</Label>
          <JalaliDatePicker value={to} onChange={setTo} clearable />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="بلیت فروخته‌شده" value={toFa(overall?.ticketCount ?? 0)} />
        <StatCard label="مبلغ فروش" value={money(overall?.revenue ?? 0)} />
        <StatCard label="ظرفیت" value={toFa(overall?.capacity ?? 0)} />
        <StatCard label="ورودها" value={toFa(overall?.entries ?? 0)} />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">به تفکیک نمایش</h2>
      {(perShow ?? []).length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">فروشی در این بازه ثبت نشده است.</p>
      ) : (
        <div className="space-y-3">
          {(perShow ?? []).map((r) => (
            <div key={r.title} className="panel flex flex-wrap justify-between gap-3 p-4 text-sm">
              <span className="font-semibold">{r.title}</span>
              <span>بلیت: {toFa(r.stats.ticketCount)}</span>
              <span>ورود: {toFa(r.stats.entries)}</span>
              <span className="text-primary">{money(r.stats.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
