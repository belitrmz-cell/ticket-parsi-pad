import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setDirectorState, adminResetPassword } from "@/lib/auth.functions";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatJalaliDate, toFa } from "@/lib/persian";

export const Route = createFileRoute("/admin/_shell/directors")({
  component: Directors,
});

export function statusLabel(status: string, active: boolean) {
  if (status === "pending") return "در انتظار تأیید";
  if (status === "rejected") return "رد شده";
  return active ? "فعال" : "غیرفعال";
}

function Directors() {
  const qc = useQueryClient();
  const [pwTarget, setPwTarget] = useState<string | null>(null);
  const [pw, setPw] = useState("");

  const { data: directors, isLoading } = useQuery({
    queryKey: ["directors"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "director");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const mutate = useMutation({
    mutationFn: (vars: { directorId: string; status?: string; isActive?: boolean }) =>
      setDirectorState({
        data: vars as { directorId: string; status?: "pending" | "approved" | "rejected" },
      }),
    onSuccess: () => {
      toast.success("تغییرات ذخیره شد.");
      void qc.invalidateQueries({ queryKey: ["directors"] });
      void qc.invalidateQueries({ queryKey: ["director-requests"] });
    },
    onError: () => toast.error("انجام عملیات ناموفق بود."),
  });

  const resetPw = useMutation({
    mutationFn: (vars: { directorId: string; password: string }) =>
      adminResetPassword({ data: vars }),
    onSuccess: () => {
      toast.success("رمز عبور تغییر کرد.");
      setPwTarget(null);
      setPw("");
    },
    onError: () => toast.error("تغییر رمز ناموفق بود."),
  });

  return (
    <>
      <PageTitle title="کارگردان‌ها" />
      {isLoading ? <p className="text-sm text-muted-foreground">در حال بارگذاری…</p> : null}
      {!isLoading && (directors ?? []).length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">هنوز کارگردانی ثبت نشده است.</p>
      ) : null}

      <div className="space-y-3">
        {(directors ?? []).map((d) => (
          <div key={d.id} className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{d.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  نام کاربری: {d.username} • موبایل: {toFa(d.mobile)} • {d.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  تاریخ ثبت‌نام: {formatJalaliDate(d.created_at)}
                </p>
              </div>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs " +
                  (d.status === "approved" && d.is_active
                    ? "bg-success/20 text-success"
                    : d.status === "pending"
                      ? "bg-warning/20 text-warning"
                      : "bg-destructive/20 text-destructive")
                }
              >
                {statusLabel(d.status, d.is_active)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {d.status !== "approved" ? (
                <Button
                  size="sm"
                  onClick={() => mutate.mutate({ directorId: d.id, status: "approved" })}
                >
                  تأیید
                </Button>
              ) : null}
              {d.status !== "rejected" ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => mutate.mutate({ directorId: d.id, status: "rejected" })}
                >
                  رد
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => mutate.mutate({ directorId: d.id, isActive: !d.is_active })}
              >
                {d.is_active ? "غیرفعال کردن" : "فعال کردن"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPwTarget(d.id)}>
                تغییر رمز
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعیین رمز عبور جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="np">رمز عبور جدید</Label>
            <Input id="np" value={pw} onChange={(e) => setPw(e.target.value)} type="text" />
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                pwTarget && pw.length >= 6
                  ? resetPw.mutate({ directorId: pwTarget, password: pw })
                  : toast.error("رمز عبور باید حداقل ۶ نویسه باشد.")
              }
            >
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
