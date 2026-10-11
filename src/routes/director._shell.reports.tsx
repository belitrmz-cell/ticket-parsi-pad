import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle, StatCard } from "@/components/AppShell";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatJalaliDate, formatTime, money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/reports")({
  head: () => ({
    meta: [
      { title: "گزارش‌ها — پنل کارگردان" },
      { name: "description", content: "گزارش فروش، ظرفیت و ورود سانس‌های نمایش" },
    ],
  }),
  component: DirectorReports,
});

type SessionRow = {
  id: string;
  show_id: string;
  hall_id: string;
  starts_at: string;
  shows: { title: string } | null;
  halls: { name: string } | null;
};

function DirectorReports() {
  const { userId } = useAuth();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [showId, setShowId] = useState("");

  const { data: shows } = useQuery({
    queryKey: ["dir-report-shows", userId],
    enabled: !!userId,
    queryFn: async () =>
      (await supabase.from("shows").select("id,title").eq("director_id", userId!).order("title"))
        .data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["dir-report", userId, from, to, showId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from("show_sessions")
        .select("id,show_id,hall_id,starts_at,shows(title),halls(name)")
        .eq("director_id", userId!)
        .order("starts_at");
      if (showId) q = q.eq("show_id", showId);
      if (from) q = q.gte("starts_at", `${from}T00:00:00`);
      if (to) q = q.lte("starts_at", `${to}T23:59:59`);
      const sessions = ((await q).data ?? []) as unknown as SessionRow[];
      const ids = sessions.map((s) => s.id);
      const hallIds = [...new Set(sessions.map((s) => s.hall_id))];
      if (!ids.length) return { sessions, tickets: [], entries: [], seats: [], txs: [] };
      const [t, e, s, x] = await Promise.all([
        supabase.from("tickets").select("session_id,price,transaction_id").in("session_id", ids),
        supabase.from("entries").select("session_id").in("session_id", ids),
        supabase.from("seats").select("hall_id").in("hall_id", hallIds).eq("is_active", true),
        supabase
          .from("transactions")
          .select("id,operator_name,total_amount,session_id")
          .in("session_id", ids),
      ]);
      return {
        sessions,
        tickets: t.data ?? [],
        entries: e.data ?? [],
        seats: s.data ?? [],
        txs: x.data ?? [],
      };
    },
  });

  const report = useMemo(() => {
    if (!data) return null;
    const cap = new Map<string, number>();
    data.seats.forEach((s) => cap.set(s.hall_id, (cap.get(s.hall_id) ?? 0) + 1));
    const rows = data.sessions.map((s) => {
      const tk = data.tickets.filter((t) => t.session_id === s.id);
      const en = data.entries.filter((e) => e.session_id === s.id).length;
      const capacity = cap.get(s.hall_id) ?? 0;
      return {
        ...s,
        capacity,
        sold: tk.length,
        revenue: tk.reduce((a, t) => a + Number(t.price), 0),
        entered: en,
      };
    });
    const totals = rows.reduce(
      (a, r) => ({
        sold: a.sold + r.sold,
        revenue: a.revenue + r.revenue,
        capacity: a.capacity + r.capacity,
        entered: a.entered + r.entered,
      }),
      { sold: 0, revenue: 0, capacity: 0, entered: 0 },
    );
    const ops = new Map<string, { count: number; tickets: number; amount: number }>();
    const txTickets = new Map<string, number>();
    data.tickets.forEach((t) =>
      txTickets.set(t.transaction_id, (txTickets.get(t.transaction_id) ?? 0) + 1),
    );
    data.txs.forEach((tx) => {
      const k = tx.operator_name || "نامشخص";
      const o = ops.get(k) ?? { count: 0, tickets: 0, amount: 0 };
      o.count++;
      o.tickets += txTickets.get(tx.id) ?? 0;
      o.amount += Number(tx.total_amount);
      ops.set(k, o);
    });
    return { rows, totals, ops: [...ops.entries()] };
  }, [data]);

  const t = report?.totals;
  const occupancy = t && t.capacity ? Math.round((t.sold / t.capacity) * 100) : 0;
  const noShow = t && t.sold ? Math.round(((t.sold - t.entered) / t.sold) * 100) : 0;

  return (
    <div className="report-print">
      <div className="hidden print:block mb-4 border-b-2 border-black pb-3 text-center">
        <h1 className="text-xl font-bold">گزارش عملکرد و فروش نمایش</h1>
        <p className="text-sm">
          {showId ? (shows ?? []).find((s) => s.id === showId)?.title : "همه نمایش‌ها"}
          {" — "}
          {from ? `از ${formatJalaliDate(from)}` : ""} {to ? `تا ${formatJalaliDate(to)}` : ""}
        </p>
        <p className="text-xs">تاریخ تهیه: {formatJalaliDate(new Date().toISOString())}</p>
      </div>
      <div className="print:hidden">
      <PageTitle
        title="گزارش‌ها"
        action={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> چاپ گزارش
          </Button>
        }
      />
      </div>
      <div className="panel mb-6 grid gap-4 p-4 md:grid-cols-3 print:hidden">
        <div className="space-y-2">
          <Label>نمایش</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={showId}
            onChange={(e) => setShowId(e.target.value)}
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
          <Label>از تاریخ</Label>
          <JalaliDatePicker value={from} onChange={setFrom} clearable />
        </div>
        <div className="space-y-2">
          <Label>تا تاریخ</Label>
          <JalaliDatePicker value={to} onChange={setTo} clearable />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="مبلغ فروش" value={money(t?.revenue ?? 0)} />
        <StatCard label="بلیت فروخته‌شده" value={toFa(t?.sold ?? 0)} />
        <StatCard label="ظرفیت کل" value={toFa(t?.capacity ?? 0)} />
        <StatCard label="درصد اشغال" value={`${toFa(occupancy)}٪`} />
        <StatCard label="ورودها" value={toFa(t?.entered ?? 0)} />
        <StatCard label="عدم حضور" value={`${toFa(noShow)}٪`} />
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">به تفکیک سانس</h2>
      {!report?.rows.length ? (
        <p className="panel p-6 text-sm text-muted-foreground">سانسی در این بازه وجود ندارد.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                {["نمایش", "تاریخ", "ساعت", "سالن", "ظرفیت", "فروخته", "مبلغ", "ورود"].map((h) => (
                  <th key={h} className="p-3 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{r.shows?.title}</td>
                  <td className="p-3">{formatJalaliDate(r.starts_at)}</td>
                  <td className="p-3">{formatTime(r.starts_at)}</td>
                  <td className="p-3">{r.halls?.name}</td>
                  <td className="p-3">{toFa(r.capacity)}</td>
                  <td className="p-3">{toFa(r.sold)}</td>
                  <td className="p-3 text-primary">{money(r.revenue)}</td>
                  <td className="p-3">{toFa(r.entered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-lg font-bold">به تفکیک اپراتور باجه</h2>
      {!report?.ops.length ? (
        <p className="panel p-6 text-sm text-muted-foreground">فروشی ثبت نشده است.</p>
      ) : (
        <div className="space-y-3">
          {report.ops.map(([name, o]) => (
            <div key={name} className="panel flex flex-wrap justify-between gap-3 p-4 text-sm">
              <span className="font-semibold">{name}</span>
              <span>فروش: {toFa(o.count)}</span>
              <span>بلیت: {toFa(o.tickets)}</span>
              <span className="text-primary">{money(o.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
