import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { changeAdminPassword, getAdminRecoveryEmail, setAdminRecoveryEmail } from "@/lib/admin-account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminAccountSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-recovery-email"], queryFn: () => getAdminRecoveryEmail() });
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  useEffect(() => { if (!editing) setEmail(data?.email ?? ""); }, [data?.email, editing]);

  const saveEmail = async () => {
    setBusy(true);
    try {
      await setAdminRecoveryEmail({ data: { email } });
      await qc.invalidateQueries({ queryKey: ["admin-recovery-email"] });
      setEditing(false);
      toast.success("ایمیل بازیابی ذخیره شد.");
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes("ایمیل") ? e.message : "ایمیل معتبر نیست.");
    }
    setBusy(false);
  };

  const savePass = async () => {
    if (p1.length < 6) { toast.error("رمز باید حداقل ۶ نویسه باشد."); return; }
    if (p1 !== p2) { toast.error("رمز و تکرار آن یکسان نیستند."); return; }
    setBusy(true);
    try {
      await changeAdminPassword({ data: { password: p1 } });
      setP1(""); setP2("");
      toast.success("رمز عبور تغییر کرد.");
    } catch {
      toast.error("تغییر رمز ناموفق بود.");
    }
    setBusy(false);
  };

  return (
    <>
      <div className="panel mb-4 space-y-3 p-5">
        <h2 className="font-semibold">ایمیل بازیابی رمز مدیر</h2>
        <p className="text-xs text-muted-foreground">در صورت فراموشی رمز، لینک تعیین رمز جدید به این ایمیل ارسال می‌شود.</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input dir="ltr" type="email" value={email} readOnly={!editing}
              onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com"
              className={editing ? "" : "bg-secondary pl-9"} />
            {!editing && <Lock className="absolute inset-y-0 left-2.5 my-auto size-4 text-muted-foreground" />}
          </div>
          {editing ? (
            <>
              <Button onClick={() => void saveEmail()} disabled={busy}>ذخیره</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>انصراف</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>ویرایش</Button>
          )}
        </div>
      </div>

      <div className="panel mb-4 space-y-3 p-5">
        <h2 className="font-semibold">تغییر رمز عبور مدیر</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>رمز جدید</Label>
            <Input type="password" dir="ltr" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
          <div className="space-y-1"><Label>تکرار رمز جدید</Label>
            <Input type="password" dir="ltr" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
        </div>
        <Button onClick={() => void savePass()} disabled={busy}>بروزرسانی رمز عبور</Button>
      </div>
    </>
  );
}
