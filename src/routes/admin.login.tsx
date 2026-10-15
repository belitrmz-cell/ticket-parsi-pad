import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSystem } from "@/lib/auth.functions";
import { panelPwaHead } from "@/lib/pwa";
import { PERSIAN_ERRORS } from "@/lib/account";
import { adminSignIn, requestAdminRecovery } from "@/lib/admin-account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/login")({
  head: () => {
    const pwa = panelPwaHead("admin");
    return {
      meta: [
        { title: "ورود مدیر | سامانه بلیت" },
        { name: "description", content: "ورود مدیر سامانه به پنل مدیریت نمایش‌ها و کارگردان‌ها." },
        { property: "og:title", content: "ورود مدیر | سامانه بلیت" },
        { property: "og:description", content: "ورود مدیر سامانه به پنل مدیریت." },
        ...pwa.meta,
      ],
      links: pwa.links,
    };
  },
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void bootstrapSystem();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const r = await adminSignIn({ data: { username: username.trim(), password: password.trim() } });
      if ("error" in r && r.error) throw new Error(r.error);
      const { error } = await supabase.auth.setSession({
        access_token: (r as { access_token: string }).access_token,
        refresh_token: (r as { refresh_token: string }).refresh_token,
      });
      if (error) throw new Error(PERSIAN_ERRORS.invalidCredentials);
      toast.success("خوش آمدید");
      navigate({ to: "/admin/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : PERSIAN_ERRORS.invalidCredentials);
    }
    setBusy(false);
  };

  const recover = async () => {
    setSending(true);
    try {
      const r = await requestAdminRecovery({ data: { origin: window.location.origin } });
      if (r.ok) toast.success("لینک تعیین رمز جدید به ایمیل بازیابی ارسال شد.");
      else if (r.reason === "no_email") toast.error("ایمیل بازیابی در تنظیمات ثبت نشده است.");
      else toast.error("ارسال ایمیل ناموفق بود؛ کمی بعد دوباره امتحان کنید.");
    } catch {
      toast.error("ارسال ایمیل ناموفق بود.");
    }
    setSending(false);
  };

  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="panel w-full max-w-sm p-7">
        <p className="text-center text-3xl">🎭</p>
        <h1 className="gold-text mt-3 text-center text-xl font-bold">ورود مدیر سامانه</h1>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u">نام کاربری</Label>
            <Input
              id="u"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">رمز عبور</Label>
            <div className="relative">
              <Input
                id="p"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "مخفی کردن رمز" : "نمایش رمز"}
                className="absolute inset-y-0 left-2 flex items-center text-muted-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "ورود"}
        </Button>

        <button
          type="button"
          onClick={() => setForgot(true)}
          className="mt-4 block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          فراموشی رمز عبور
        </button>
      </form>

      <Dialog open={forgot} onOpenChange={setForgot}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>فراموشی رمز عبور</DialogTitle>
            <DialogDescription>
              نام کاربری مدیر «Admin» است. با زدن دکمه زیر، لینک تعیین رمز جدید به ایمیل بازیابی
              ثبت‌شده در تنظیمات ارسال می‌شود.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => void recover()} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : "ارسال لینک بازیابی"}
          </Button>
          <DialogHeader>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
