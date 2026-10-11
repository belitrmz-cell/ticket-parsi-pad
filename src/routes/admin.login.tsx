import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSystem } from "@/lib/auth.functions";
import { emailForUsername, PERSIAN_ERRORS } from "@/lib/account";
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
  head: () => ({
    meta: [
      { title: "ورود مدیر | سامانه بلیت" },
      { name: "description", content: "ورود مدیر سامانه به پنل مدیریت نمایش‌ها و کارگردان‌ها." },
      { property: "og:title", content: "ورود مدیر | سامانه بلیت" },
      { property: "og:description", content: "ورود مدیر سامانه به پنل مدیریت." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailForUsername(username),
      password,
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error(PERSIAN_ERRORS.invalidCredentials);
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error(PERSIAN_ERRORS.notAdmin);
      return;
    }
    toast.success("خوش آمدید");
    navigate({ to: "/admin/dashboard" });
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
              برای بازیابی رمز عبور مدیر سامانه، با پشتیبانی فنی سامانه تماس بگیرید. به دلایل
              امنیتی، بازیابی رمز مدیر از طریق فرم عمومی انجام نمی‌شود.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
