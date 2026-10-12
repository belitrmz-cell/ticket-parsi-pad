import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkDirectorLink, registerDirector } from "@/lib/auth.functions";
import { panelPwaHead } from "@/lib/pwa";
import { emailForUsername, PERSIAN_ERRORS } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/director-access/$token")({
  head: ({ params }) => {
    const pwa = panelPwaHead("director", `/director-access/${params.token}`);
    return {
      meta: [
        { title: "ورود و ثبت‌نام کارگردان | سامانه بلیت" },
        { name: "description", content: "ثبت‌نام و ورود کارگردان‌ها به پنل مدیریت نمایش و سالن." },
        { property: "og:title", content: "ورود و ثبت‌نام کارگردان" },
        { property: "og:description", content: "پنل کارگردان: سالن، نمایش، سانس، بلیت و گزارش." },
        ...pwa.meta,
      ],
      links: pwa.links,
    };
  },
  component: DirectorGate,
});

function DirectorGate() {
  const { token } = useParams({ from: "/director-access/$token" });
  const { data, isLoading } = useQuery({
    queryKey: ["director-link-check", token],
    queryFn: () => checkDirectorLink({ data: { token } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.valid) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center px-5">
        <div className="panel p-8 text-center">
          <p className="text-lg font-semibold">{PERSIAN_ERRORS.linkInvalid}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="panel w-full max-w-md p-6">
        <p className="text-center text-3xl">🎭</p>
        <h1 className="gold-text mt-2 text-center text-xl font-bold">پنل کارگردان</h1>
        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">ورود</TabsTrigger>
            <TabsTrigger value="register">ثبت‌نام</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm token={token} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("profiles").select("status,is_active").eq("id", data.user.id).maybeSingle(),
    ]);
    const isDirector = roles?.some((r) => r.role === "director");
    let problem: string | null = null;
    if (!isDirector) problem = PERSIAN_ERRORS.notDirector;
    else if (profile?.status === "pending") problem = PERSIAN_ERRORS.pending;
    else if (profile?.status === "rejected") problem = PERSIAN_ERRORS.rejected;
    else if (!profile?.is_active) problem = PERSIAN_ERRORS.inactive;

    if (problem) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error(problem);
      return;
    }
    toast.success("خوش آمدید");
    navigate({ to: "/director/dashboard" });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lu">نام کاربری</Label>
        <Input id="lu" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lp">رمز عبور</Label>
        <div className="relative">
          <Input
            id="lp"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "ورود"}
      </Button>
    </form>
  );
}

function RegisterForm({ token }: { token: string }) {
  const [form, setForm] = useState({
    full_name: "",
    mobile: "",
    email: "",
    username: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("رمز عبور و تکرار آن یکسان نیست.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("رمز عبور باید حداقل ۶ نویسه باشد.");
      return;
    }
    setBusy(true);
    try {
      await registerDirector({
        data: {
          token,
          full_name: form.full_name,
          mobile: form.mobile,
          email: form.email,
          username: form.username,
          password: form.password,
        },
      });
      toast.success("ثبت‌نام انجام شد. پس از تأیید مدیر می‌توانید وارد شوید.");
      setForm({ full_name: "", mobile: "", email: "", username: "", password: "", confirm: "" });
    } catch {
      toast.error(PERSIAN_ERRORS.duplicate);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="rn">نام و نام خانوادگی</Label>
        <Input id="rn" required value={form.full_name} onChange={set("full_name")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rm">موبایل</Label>
        <Input id="rm" required inputMode="numeric" value={form.mobile} onChange={set("mobile")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="re">ایمیل</Label>
        <Input id="re" required type="email" dir="ltr" value={form.email} onChange={set("email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ru">نام کاربری</Label>
        <Input id="ru" required dir="ltr" value={form.username} onChange={set("username")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rp">رمز عبور</Label>
        <Input id="rp" required type="password" value={form.password} onChange={set("password")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rc">تکرار رمز عبور</Label>
        <Input id="rc" required type="password" value={form.confirm} onChange={set("confirm")} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "ثبت‌نام"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        پس از ثبت‌نام، حساب شما در وضعیت «در انتظار تأیید» قرار می‌گیرد.
      </p>
    </form>
  );
}
