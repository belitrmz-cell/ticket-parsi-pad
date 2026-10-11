import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Eye, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { dateStrToJalali, faToEn, money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/shows")({
  head: () => ({
    meta: [
      { title: "نمایش‌ها | پنل کارگردان" },
      { name: "description", content: "مدیریت نمایش‌های کارگردان: ساخت، ویرایش و وضعیت." },
      { property: "og:title", content: "نمایش‌ها" },
      { property: "og:description", content: "مدیریت نمایش‌های کارگردان." },
    ],
  }),
  component: ShowsPage,
});

type Form = {
  id?: string;
  title: string;
  description: string;
  poster_url: string;
  hall_id: string;
  start_date: string | null;
  end_date: string | null;
  price: string;
  is_active: boolean;
  hasSessions?: boolean;
  times: string[];
};

function parseTime(t: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(faToEn(t.trim()));
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return [Number(m[1]), Number(m[2])];
}

function dayList(a: string | null, b: string | null): string[] {
  if (!a || !b || b < a) return [];
  const out: string[] = [];
  const [y, m, d] = a.split("-").map(Number) as [number, number, number];
  const cur = new Date(y, m - 1, d);
  for (let i = 0; i < 400; i++) {
    const s = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    if (s > b) break;
    out.push(s);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const blank: Form = {
  title: "",
  description: "",
  poster_url: "",
  hall_id: "",
  start_date: null,
  end_date: null,
  price: "",
  is_active: true,
  times: [""],
};

function ShowsPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const halls = useQuery({
    queryKey: ["my-halls-lite", userId],
    queryFn: async () =>
      (await supabase.from("halls").select("id,name,is_active").eq("director_id", userId!).is("deleted_at", null).order("name")).data ?? [],
    enabled: !!userId,
  });

  const shows = useQuery({
    queryKey: ["my-shows", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shows")
        .select("*, halls(name), show_sessions(id)")
        .eq("director_id", userId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["my-shows"] });
    void qc.invalidateQueries({ queryKey: ["my-sessions"] });
  };

  const save = async () => {
    if (!form || !userId) return;
    if (form.title.trim().length < 2) { toast.error("نام نمایش را وارد کنید."); return; }
    if (!form.hall_id) { toast.error("سالن را انتخاب کنید."); return; }
    if (!form.start_date || !form.end_date) { toast.error("بازهٔ اجرای نمایش را انتخاب کنید."); return; }
    if (form.end_date < form.start_date) { toast.error("تاریخ پایان باید بعد از تاریخ شروع باشد."); return; }
    const price = Number(faToEn(form.price.replace(/[,،]/g, "")).trim() || "0");
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price))
      { toast.error("قیمت بلیت معتبر نیست."); return; }
    const times = form.times.filter((t) => t.trim());
    const parsed = times.map(parseTime);
    if (parsed.some((p) => !p)) { toast.error("ساعت سانس‌ها را به شکل ۱۸:۳۰ وارد کنید."); return; }
    const days = dayList(form.start_date, form.end_date);
    if (days.length * parsed.length > 1000) { toast.error("تعداد سانس‌ها بیش از حد مجاز است."); return; }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      poster_url: form.poster_url.trim() || null,
      hall_id: form.hall_id,
      start_date: form.start_date,
      end_date: form.end_date,
      price,
      is_active: form.is_active,
    };
    setBusy(true);
    const { data: saved, error } = form.id
      ? await supabase.from("shows").update(payload).eq("id", form.id).select("id").single()
      : await supabase.from("shows").insert({ ...payload, director_id: userId }).select("id").single();
    if (error || !saved) { setBusy(false); toast.error("ذخیره نمایش ناموفق بود."); return; }
    let created = 0;
    if (parsed.length && days.length) {
      const now = Date.now();
      const rows = days.flatMap((day) => {
        const [y, m, d] = day.split("-").map(Number) as [number, number, number];
        return parsed.map((p) => new Date(y, m - 1, d, p![0], p![1]));
      })
        .filter((dt) => dt.getTime() > now)
        .map((dt) => ({ show_id: saved.id, director_id: userId, hall_id: form.hall_id, starts_at: dt.toISOString() }));
      if (rows.length) {
        const { data: ins, error: e2 } = await supabase
          .from("show_sessions")
          .upsert(rows, { onConflict: "show_id,starts_at", ignoreDuplicates: true })
          .select("id");
        if (e2) toast.error("ساخت سانس‌ها ناموفق بود.");
        created = ins?.length ?? 0;
      }
    }
    setBusy(false);
    toast.success(
      (form.id ? "نمایش ویرایش شد." : "نمایش ساخته شد.") + (created ? ` ${toFa(created)} سانس جدید ساخته شد.` : ""),
    );
    setForm(null);
    refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("shows").update({ is_active: !active }).eq("id", id);
    if (error) toast.error("تغییر وضعیت ناموفق بود.");
    refresh();
  };

  const [delId, setDelId] = useState<string | null>(null);
  const remove = async () => {
    if (!delId) return;
    const { data, error } = await supabase.rpc("delete_show", { _show: delId });
    if (error) { toast.error("حذف نمایش ناموفق بود."); return; }
    toast.success(
      data === "archived"
        ? "نمایش حذف شد. سوابق فروش و بلیت‌های قبلی برای گزارش‌ها حفظ شدند."
        : "نمایش حذف شد.",
    );
    setDelId(null);
    refresh();
  };

  const noHalls = halls.isSuccess && halls.data.length === 0;
  const viewed = shows.data?.find((s) => s.id === view);

  return (
    <>
      <PageTitle title="نمایش‌ها" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button className="gap-2" disabled={noHalls} onClick={() => setForm({ ...blank })}>
          <Plus className="size-4" /> افزودن نمایش
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/director/sessions">
            <CalendarClock className="size-4" /> سانس‌های نمایش
          </Link>
        </Button>
        {noHalls ? (
          <p className="text-sm text-muted-foreground">
            ابتدا یک سالن بسازید.{" "}
            <Link to="/director/halls" className="text-primary underline">
              سالن‌های من
            </Link>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(shows.data ?? []).map((s) => {
          const count = s.show_sessions?.length ?? 0;
          return (
            <div key={s.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    سالن: {s.halls?.name ?? "—"} • {toFa(count)} سانس
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${s.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {s.is_active ? "فعال" : "غیرفعال"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => setView(s.id)}>
                  <Eye className="size-4" /> مشاهده
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() =>
                    setForm({
                      id: s.id,
                      title: s.title,
                      description: s.description,
                      poster_url: s.poster_url ?? "",
                      hall_id: s.hall_id,
                      start_date: s.start_date,
                      end_date: s.end_date,
                      price: String(s.price),
                      is_active: s.is_active,
                      hasSessions: count > 0,
                      times: [""],
                    })
                  }
                >
                  <Pencil className="size-4" /> ویرایش
                </Button>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggle(s.id, s.is_active)}>
                  <Power className="size-4" /> {s.is_active ? "غیرفعال" : "فعال"}
                </Button>
                <Button asChild size="sm" variant="ghost" className="gap-1">
                  <Link to="/director/sessions" search={{ show: s.id }}>
                    <CalendarClock className="size-4" /> سانس‌ها
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setDelId(s.id)}>
                  <Trash2 className="size-4" /> حذف
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {shows.isSuccess && shows.data.length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">هنوز نمایشی نساخته‌اید.</p>
      ) : null}

      <ConfirmDeleteDialog
        open={!!delId}
        title="حذف نمایش"
        message="آیا از حذف این نمایش مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        onCancel={() => setDelId(null)}
        onConfirm={remove}
      />

      <Dialog open={!!viewed} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{viewed?.title}</DialogTitle>
          </DialogHeader>
          {viewed ? (
            <div className="space-y-2 text-sm">
              {viewed.poster_url ? (
                <img src={viewed.poster_url} alt={viewed.title} className="max-h-60 rounded-md object-contain" />
              ) : null}
              <p className="whitespace-pre-wrap text-muted-foreground">{viewed.description || "بدون توضیحات"}</p>
              <p>سالن: {viewed.halls?.name}</p>
              <p>
                اجرا: {dateStrToJalali(viewed.start_date)} تا {dateStrToJalali(viewed.end_date)}
              </p>
              <p>قیمت بلیت: {money(viewed.price)}</p>
              <p>وضعیت: {viewed.is_active ? "فعال" : "غیرفعال"}</p>
              <p>تعداد سانس‌ها: {toFa(viewed.show_sessions?.length ?? 0)}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "ویرایش نمایش" : "افزودن نمایش"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>نام نمایش</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>توضیحات</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>آدرس تصویر پوستر (اختیاری)</Label>
                <Input dir="ltr" value={form.poster_url} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>سالن</Label>
                <select
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={form.hall_id}
                  disabled={form.hasSessions}
                  onChange={(e) => setForm({ ...form, hall_id: e.target.value })}
                >
                  <option value="">انتخاب سالن</option>
                  {(halls.data ?? []).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {h.is_active ? "" : " (غیرفعال)"}
                    </option>
                  ))}
                </select>
                {form.hasSessions ? (
                  <p className="text-xs text-muted-foreground">این نمایش سانس دارد؛ سالن قابل تغییر نیست.</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>تاریخ شروع اجرا</Label>
                  <JalaliDatePicker value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
                </div>
                <div className="space-y-1">
                  <Label>تاریخ پایان اجرا</Label>
                  <JalaliDatePicker value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <Label>سانس‌های روزانه</Label>
                {form.id ? (
                  <p className="text-xs text-muted-foreground">ساعت‌های جدید به روزهای آیندهٔ بازه اضافه می‌شوند؛ سانس‌های قبلی تکرار نمی‌شوند.</p>
                ) : null}
                {form.times.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-14 text-xs text-muted-foreground">سانس {toFa(i + 1)}</span>
                    <Input
                      dir="ltr"
                      placeholder="18:30"
                      value={t}
                      onChange={(e) => setForm({ ...form, times: form.times.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, times: form.times.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setForm({ ...form, times: [...form.times, ""] })}>
                  <Plus className="size-4" /> افزودن سانس
                </Button>
                {(() => {
                  const d = dayList(form.start_date, form.end_date).length;
                  const n = form.times.filter((x) => parseTime(x)).length;
                  return d && n ? (
                    <p className="text-xs font-semibold">
                      برنامه شما: {toFa(d)} روز × {toFa(n)} سانس = {toFa(d * n)} سانس
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-1">
                <Label>قیمت بلیت (تومان)</Label>
                <Input inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>وضعیت</Label>
                <select
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={form.is_active ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
                >
                  <option value="1">فعال</option>
                  <option value="0">غیرفعال</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button disabled={busy} onClick={() => void save()}>
                  {form.times.some((x) => parseTime(x)) ? "ذخیره و ایجاد سانس‌ها" : "ذخیره"}
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
