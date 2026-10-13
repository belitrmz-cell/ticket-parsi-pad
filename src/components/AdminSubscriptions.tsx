import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { faToEn, formatJalaliDate, money } from "@/lib/persian";
import { durationLabel, kindLabel, requestState, rpcError, type SubKind } from "@/lib/subscription";

type Plan = { id: string | null; name: string; kind: SubKind; duration: number; price: number; is_active: boolean };
const EMPTY: Plan = { id: null, name: "", kind: "daily", duration: 1, price: 100000, is_active: true };

export function AdminSubscriptions() {
  const qc = useQueryClient();
  const plans = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () =>
      (await supabase.from("subscription_plans").select("*").order("created_at")).data ?? [],
  });
  const reqs = useQuery({
    queryKey: ["admin-sub-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_requests")
        .select("*, profiles(full_name,username)")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });
  const [edit, setEdit] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  const savePlan = async () => {
    if (!edit || !edit.name.trim() || edit.duration < 1 || edit.price < 0) {
      toast.error("نام، مدت و مبلغ را درست وارد کنید.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("save_subscription_plan", {
      _id: edit.id as string, _name: edit.name.trim(), _kind: edit.kind,
      _duration: edit.duration, _price: edit.price, _active: edit.is_active,
    });
    setBusy(false);
    if (error) { toast.error(rpcError(error.message)); return; }
    toast.success("اشتراک ذخیره شد.");
    setEdit(null);
    void qc.invalidateQueries({ queryKey: ["admin-plans"] });
  };

  const decide = async (id: string, approve: boolean) => {
    let reason = "";
    if (!approve) {
      const r = window.prompt("دلیل رد درخواست (اختیاری):");
      if (r === null) return;
      reason = r;
    } else if (!window.confirm("پرداخت دریافت شده و اشتراک از همین الان فعال شود؟")) return;
    const { error } = await supabase.rpc("decide_subscription", { _request: id, _approve: approve, _reason: reason });
    if (error) { toast.error(rpcError(error.message)); return; }
    toast.success(approve ? "اشتراک فعال شد." : "درخواست رد شد.");
    void qc.invalidateQueries({ queryKey: ["admin-sub-requests"] });
  };

  const num = (v: string) => Number(faToEn(v).replace(/[^0-9]/g, "")) || 0;

  return (
    <>
      <div className="panel mt-4 space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">اشتراک‌های فروش بلیت</h2>
          <Button size="sm" onClick={() => setEdit({ ...EMPTY })}>اشتراک جدید</Button>
        </div>
        <div className="space-y-2">
          {(plans.data ?? []).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary p-3 text-sm">
              <span>
                {p.name} — {kindLabel(p.kind)} — {durationLabel(p.kind, p.duration)} — {money(Number(p.price))}
                {!p.is_active && <span className="ms-2 text-muted-foreground">(غیرفعال)</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() =>
                setEdit({ id: p.id, name: p.name, kind: p.kind as SubKind, duration: p.duration, price: Number(p.price), is_active: p.is_active })}>
                ویرایش
              </Button>
            </div>
          ))}
          {plans.data?.length === 0 && <p className="text-sm text-muted-foreground">اشتراکی تعریف نشده است.</p>}
        </div>
        {edit && (
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>نام اشتراک</Label>
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>نوع</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value as SubKind })}>
                <option value="daily">روزانه</option><option value="monthly">ماهانه</option>
              </select></div>
            <div className="space-y-1"><Label>تعداد {edit.kind === "daily" ? "روز" : "ماه"}</Label>
              <Input dir="ltr" value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: num(e.target.value) })} /></div>
            <div className="space-y-1"><Label>مبلغ کل (تومان)</Label>
              <Input dir="ltr" value={edit.price} onChange={(e) => setEdit({ ...edit, price: num(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              فعال (قابل مشاهده برای کارگردان‌ها)
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={() => void savePlan()} disabled={busy}>ذخیره</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>انصراف</Button>
            </div>
          </div>
        )}
      </div>

      <div className="panel mt-4 space-y-3 p-5">
        <h2 className="font-semibold">درخواست‌های خرید اشتراک</h2>
        {(reqs.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">درخواستی ثبت نشده است.</p>}
        {(reqs.data ?? []).map((r) => {
          const st = requestState(r);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prof = (r as any).profiles as { full_name: string; username: string } | null;
          return (
            <div key={r.id} className="space-y-1 rounded-md bg-secondary p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{prof?.full_name || prof?.username}</span>
                <span>{st.label}</span>
              </div>
              <div className="text-muted-foreground">
                {r.plan_name} — {kindLabel(r.kind)} — {durationLabel(r.kind, r.duration)} — {money(Number(r.price))} — درخواست: {formatJalaliDate(r.created_at)}
              </div>
              {r.starts_at && r.ends_at && (
                <div className="text-muted-foreground">از {formatJalaliDate(r.starts_at)} تا {formatJalaliDate(r.ends_at)}</div>
              )}
              {r.reject_reason && <div className="text-muted-foreground">دلیل رد: {r.reject_reason}</div>}
              {r.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => void decide(r.id, true)}>تأیید و فعال‌سازی</Button>
                  <Button size="sm" variant="destructive" onClick={() => void decide(r.id, false)}>رد</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
