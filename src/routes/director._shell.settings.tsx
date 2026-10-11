import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listOperators } from "@/lib/operators.functions";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/settings")({
  head: () => ({
    meta: [
      { title: "تنظیمات — پنل کارگردان" },
      { name: "description", content: "اطلاعات حساب، رمز عبور و لینک‌های اپراتور کارگردان" },
    ],
  }),
  component: DirectorSettings,
});

function DirectorSettings() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchOps = useServerFn(listOperators);
  const { data: ops } = useQuery({ queryKey: ["dir-settings-ops"], queryFn: () => fetchOps() });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setMobile(profile.mobile);
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!profile || !name.trim()) { toast.error("نام نمی‌تواند خالی باشد."); return; }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), mobile: mobile.trim() })
      .eq("id", profile.id);
    setBusy(false);
    if (error) { toast.error("ذخیره انجام نشد."); return; }
    toast.success("اطلاعات حساب ذخیره شد.");
    refresh();
  };

  const changePw = async () => {
    if (pw.length < 6) { toast.error("رمز عبور باید حداقل ۶ کاراکتر باشد."); return; }
    if (pw !== pw2) { toast.error("تکرار رمز عبور یکسان نیست."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error("تغییر رمز انجام نشد."); return; }
    setPw("");
    setPw2("");
    toast.success("رمز عبور تغییر کرد.");
  };

  const base = (ops?.publicAppUrl || (typeof window !== "undefined" ? window.location.origin : ""))
    .replace(/\/+$/, "");
  const links = ops
    ? [
        { label: "لینک باجه فروش", url: `${base}/booth/${ops.boothToken}`, max: ops.maxBooth },
        { label: "لینک کنترل ورود", url: `${base}/entry/${ops.entryToken}`, max: ops.maxEntry },
      ]
    : [];

  return (
    <>
      <PageTitle title="تنظیمات" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-4 p-5">
          <h2 className="font-semibold">اطلاعات حساب</h2>
          <div className="space-y-2">
            <Label>نام کاربری</Label>
            <Input value={profile?.username ?? ""} disabled dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n">نام و نام خانوادگی</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m">شماره موبایل</Label>
            <Input id="m" dir="ltr" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <Button onClick={() => void saveProfile()} disabled={busy}>
            ذخیره اطلاعات
          </Button>
        </div>

        <div className="panel space-y-4 p-5">
          <h2 className="font-semibold">تغییر رمز عبور</h2>
          <div className="space-y-2">
            <Label htmlFor="p1">رمز عبور جدید</Label>
            <Input id="p1" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p2">تکرار رمز عبور</Label>
            <Input id="p2" type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button onClick={() => void changePw()} disabled={busy}>
            تغییر رمز
          </Button>
        </div>
      </div>

      <div className="panel mt-4 space-y-4 p-5">
        <h2 className="font-semibold">لینک‌های اپراتورها</h2>
        {links.map((l) => (
          <div key={l.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{l.label}</span>
              <span className="text-muted-foreground">
                سقف اپراتور همزمان: {toFa(l.max)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-secondary p-3 text-xs" dir="ltr">
                {l.url}
              </code>
              <Button
                size="icon"
                variant="secondary"
                aria-label="کپی لینک"
                onClick={() => {
                  void navigator.clipboard.writeText(l.url);
                  toast.success("لینک کپی شد.");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          مدیریت دسترسی و تأیید اپراتورها از بخش «اپراتورها» انجام می‌شود.
        </p>
      </div>
    </>
  );
}
