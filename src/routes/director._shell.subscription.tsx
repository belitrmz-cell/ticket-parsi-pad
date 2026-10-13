import { createFileRoute } from "@tanstack/react-router";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatJalaliDate, money } from "@/lib/persian";
import { DIRECTOR_SALE_LOCKED, durationLabel, kindLabel, requestState, rpcError } from "@/lib/subscription";

export const Route = createFileRoute("/director/_shell/subscription")({
  head: () => ({
    meta: [
      { title: "خرید اشتراک — پنل کارگردان" },
      { name: "description", content: "انتخاب اشتراک و ثبت درخواست فعال‌سازی فروش بلیت" },
      { property: "og:title", content: "خرید اشتراک فروش بلیت" },
      { property: "og:description", content: "انتخاب اشتراک و ثبت درخواست فعال‌سازی فروش بلیت" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectorSubscription,
});

function DirectorSubscription() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const status = useSubscriptionStatus(userId);
  const plans = useQuery({
    queryKey: ["dir-plans"],
    queryFn: async () =>
      (await supabase.from("subscription_plans").select("*").eq("is_active", true).order("created_at")).data ?? [],
  });
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const reqs = status.data?.requests ?? [];
  const pending = reqs.some((r) => r.status === "pending");
  const current = reqs.find((r) => requestState(r).key === "active");

  const submit = async () => {
    if (!pick) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_subscription", { _plan: pick });
    setBusy(false);
    if (error) { toast.error(rpcError(error.message)); return; }
    toast.success("درخواست ثبت شد و در انتظار تأیید مدیر است.");
    setPick("");
    void qc.invalidateQueries({ queryKey: ["my-sub"] });
  };

  let headline = "بدون اشتراک فعال";
  if (current) headline = `اشتراک فعال تا ${formatJalaliDate(current.ends_at!)}`;
  else if (pending) headline = "درخواست اشتراک در انتظار تأیید";
  else if (reqs[0] && requestState(reqs[0]).key === "expired") headline = "اشتراک منقضی‌شده";
  else if (reqs[0]?.status === "rejected") headline = "درخواست ردشده";

  return (
    <>
      <PageTitle title="خرید اشتراک" />
      <div className="panel space-y-2 p-5">
        <h2 className="font-semibold">وضعیت: {headline}</h2>
        {!status.data?.active && <p className="text-sm leading-7 text-muted-foreground">{DIRECTOR_SALE_LOCKED}</p>}
      </div>

      <div className="panel mt-4 space-y-3 p-5">
        <h2 className="font-semibold">اشتراک‌های موجود</h2>
        {plans.data?.length === 0 && <p className="text-sm text-muted-foreground">در حال حاضر اشتراکی برای خرید تعریف نشده است.</p>}
        {(plans.data ?? []).map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md bg-secondary p-3 text-sm">
            <input type="radio" name="plan" checked={pick === p.id} onChange={() => setPick(p.id)} disabled={pending} />
            <span>{p.name} — {kindLabel(p.kind)} — {durationLabel(p.kind, p.duration)} — {money(Number(p.price))}</span>
          </label>
        ))}
        {(plans.data?.length ?? 0) > 0 && (
          <Button onClick={() => void submit()} disabled={!pick || busy || pending}>درخواست خرید اشتراک</Button>
        )}
        {pending && <p className="text-xs text-muted-foreground">تا بررسی درخواست فعلی، درخواست جدید ثبت نمی‌شود.</p>}
      </div>

      <div className="panel mt-4 space-y-2 p-5">
        <h2 className="font-semibold">درخواست‌های من</h2>
        {reqs.length === 0 && <p className="text-sm text-muted-foreground">درخواستی ثبت نکرده‌اید.</p>}
        {reqs.map((r) => (
          <div key={r.id} className="space-y-1 rounded-md bg-secondary p-3 text-sm">
            <div className="flex justify-between"><span>{r.plan_name}</span><span>{requestState(r).label}</span></div>
            <div className="text-muted-foreground">
              {kindLabel(r.kind)} — {durationLabel(r.kind, r.duration)} — {money(Number(r.price))} — {formatJalaliDate(r.created_at)}
            </div>
            {r.starts_at && r.ends_at && (
              <div className="text-muted-foreground">از {formatJalaliDate(r.starts_at)} تا {formatJalaliDate(r.ends_at)}</div>
            )}
            {r.reject_reason && <div className="text-muted-foreground">دلیل رد: {r.reject_reason}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
