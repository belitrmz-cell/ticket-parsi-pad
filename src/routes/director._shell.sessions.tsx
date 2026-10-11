import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { WEEK_DAYS, faToEn, formatJalaliDate, formatTime, jalaliParts, toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/sessions")({
  validateSearch: z.object({ show: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "سانس‌های نمایش | پنل کارگردان" },
      { name: "description", content: "ساخت و مدیریت سانس‌های نمایش با تقویم شمسی." },
      { property: "og:title", content: "سانس‌های نمایش" },
      { property: "og:description", content: "مدیریت سانس‌های نمایش." },
    ],
  }),
  component: SessionsPage,
});

type Form = { id?: string; show_id: string; date: string | null; time: string; hasSales?: boolean };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function SessionsPage() {
  const { userId } = useAuth();
  const { show: showFilter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const shows = useQuery({
    queryKey: ["my-shows-lite", userId],
    queryFn: async () =>
      (
        await supabase
          .from("shows")
          .select("id,title,is_active,hall_id,halls(name)")
          .eq("director_id", userId!)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!userId,
  });

  const sessions = useQuery({
    queryKey: ["my-sessions", userId, showFilter ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("show_sessions")
        .select("id,starts_at,is_active,show_id,hall_id,shows!inner(title,is_active,deleted_at),halls(name),tickets(id,status)")
        .eq("director_id", userId!)
        .is("shows.deleted_at", null)
        .order("starts_at", { ascending: true });
      if (showFilter) q = q.eq("show_id", showFilter);
      const list = (await q).data ?? [];
      const hallIds = [...new Set(list.map((s) => s.hall_id))];
      const cap = new Map<string, number>();
      if (hallIds.length) {
        const { data: seats } = await supabase.from("seats").select("hall_id").in("hall_id", hallIds).eq("is_active", true).gt("number", 0);
        (seats ?? []).forEach((x) => cap.set(x.hall_id, (cap.get(x.hall_id) ?? 0) + 1));
      }
      return list.map((s) => ({ ...s, capacity: cap.get(s.hall_id) ?? 0 }));
    },
    enabled: !!userId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["my-sessions"] });
    void qc.invalidateQueries({ queryKey: ["my-shows"] });
  };

  const save = async () => {
    if (!form || !userId) return;
    if (!form.show_id) { toast.error("نمایش را انتخاب کنید."); return; }
    if (!form.date) { toast.error("تاریخ سانس را انتخاب کنید."); return; }
    const m = /^(\d{1,2}):(\d{2})$/.exec(faToEn(form.time.trim()));
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) { toast.error("ساعت را به شکل ۱۸:۳۰ وارد کنید."); return; }
    const [y, mo, d] = form.date.split("-").map(Number) as [number, number, number];
    const startsAt = new Date(y, mo - 1, d, Number(m[1]), Number(m[2])).toISOString();
    const show = shows.data?.find((s) => s.id === form.show_id);
    if (!show) { toast.error("نمایش نامعتبر است."); return; }
    setBusy(true);
    const { error } = form.id
      ? await supabase.from("show_sessions").update({ starts_at: startsAt }).eq("id", form.id)
      : await supabase.from("show_sessions").insert({
          show_id: form.show_id,
          director_id: userId,
          hall_id: show.hall_id, // enforced server-side to the show's hall
          starts_at: startsAt,
        });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "برای این نمایش در همین تاریخ و ساعت قبلاً سانس ساخته شده است." : "ذخیره سانس ناموفق بود."); return; }
    toast.success(form.id ? "سانس ویرایش شد." : "سانس ساخته شد.");
    setForm(null);
    refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("show_sessions").update({ is_active: !active }).eq("id", id);
    if (error) toast.error("تغییر وضعیت ناموفق بود.");
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("سانس حذف شود؟")) return;
    const { error } = await supabase.from("show_sessions").delete().eq("id", id);
    if (error) {
      // Tickets/sales reference this session: keep history, deactivate instead
      await supabase.from("show_sessions").update({ is_active: false }).eq("id", id);
      toast.info("این سانس سابقه فروش دارد؛ برای حفظ اطلاعات، غیرفعال شد.");
    } else toast.success("سانس حذف شد.");
    refresh();
  };

  const filteredShow = shows.data?.find((s) => s.id === showFilter);

  return (
    <>
      <PageTitle title="سانس‌های نمایش" />
      <div className="panel mb-5 flex flex-wrap items-center gap-3 p-4">
        <select
          className="rounded-md border border-input bg-background p-2 text-sm"
          value={showFilter ?? ""}
          onChange={(e) => navigate({ search: { show: e.target.value || undefined } })}
        >
          <option value="">همه نمایش‌ها</option>
          {(shows.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <Button
          className="gap-2"
          disabled={!shows.data?.length}
          onClick={() => setForm({ show_id: filteredShow?.id ?? "", date: null, time: "" })}
        >
          <Plus className="size-4" /> افزودن سانس
        </Button>
        {shows.isSuccess && shows.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ابتدا یک نمایش بسازید.{" "}
            <Link to="/director/shows" className="text-primary underline">
              نمایش‌ها
            </Link>
          </p>
        ) : null}
      </div>

      <div className="panel overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-start">نمایش</th>
              <th className="p-3 text-start">تاریخ</th>
              <th className="p-3 text-start">ساعت</th>
              <th className="p-3 text-start">سالن</th>
              <th className="p-3 text-start">وضعیت</th>
              <th className="p-3 text-start">فروخته / باقی‌مانده</th>
              <th className="p-3 text-start">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {(sessions.data ?? []).map((s) => {
              const sold = (s.tickets ?? []).filter((t) => t.status !== "cancelled").length;
              const d = new Date(s.starts_at);
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3">{s.shows?.title}</td>
                  <td className="p-3">{WEEK_DAYS[jalaliParts(s.starts_at).weekday]} {formatJalaliDate(s.starts_at)}</td>
                  <td className="p-3">{formatTime(s.starts_at)}</td>
                  <td className="p-3">{s.halls?.name}</td>
                  <td className="p-3">
                    {s.is_active ? "فعال" : "غیرفعال"}
                  </td>
                  <td className="p-3">{toFa(sold)} / {toFa(Math.max(0, s.capacity - sold))}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="ویرایش"
                        onClick={() =>
                          setForm({
                            id: s.id,
                            show_id: s.show_id,
                            date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                            time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                            hasSales: sold > 0,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="فعال/غیرفعال" onClick={() => toggle(s.id, s.is_active)}>
                        <Power className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="حذف" className="text-destructive" onClick={() => remove(s.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sessions.isSuccess && sessions.data.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">سانسی ثبت نشده است.</p>
        ) : null}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "ویرایش سانس" : "افزودن سانس"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>نمایش</Label>
                <select
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={form.show_id}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, show_id: e.target.value })}
                >
                  <option value="">انتخاب نمایش</option>
                  {(shows.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {s.is_active ? "" : " (غیرفعال)"}
                    </option>
                  ))}
                </select>
                {form.show_id ? (
                  <p className="text-xs text-muted-foreground">
                    سالن: {shows.data?.find((s) => s.id === form.show_id)?.halls?.name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>تاریخ سانس</Label>
                <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              </div>
              <div className="space-y-1">
                <Label>ساعت شروع</Label>
                <Input
                  dir="ltr"
                  placeholder="18:30"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
              {form.hasSales ? (
                <p className="text-xs text-muted-foreground">برای این سانس بلیت فروخته شده است؛ تغییر زمان روی بلیت‌های قبلی چاپ‌شده اثر ندارد.</p>
              ) : null}
              <div className="flex gap-2 pt-2">
                <Button disabled={busy} onClick={() => void save()}>
                  ذخیره
                </Button>
                <Button variant="ghost" onClick={() => setForm(null)}>
                  انصراف
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
