import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/reset")({
  head: () => ({
    meta: [
      { title: "تعیین رمز جدید مدیر | سامانه بلیت" },
      { name: "description", content: "تعیین رمز عبور جدید برای مدیر سامانه." },
      { property: "og:title", content: "تعیین رمز جدید مدیر" },
      { property: "og:description", content: "تعیین رمز عبور جدید برای مدیر سامانه." },
    ],
  }),
  component: AdminReset,
});

function AdminReset() {
  const navigate = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p1.length < 6) return toast.error("رمز باید حداقل ۶ نویسه باشد.");
    if (p1 !== p2) return toast.error("رمز و تکرار آن یکسان نیستند.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return toast.error("لینک منقضی شده یا رمز پذیرفته نشد.");
    toast.success("رمز جدید ثبت شد.");
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-7">
        <h1 className="gold-text text-center text-xl font-bold">تعیین رمز جدید</h1>
        <div className="space-y-2"><Label>رمز جدید</Label>
          <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
        <div className="space-y-2"><Label>تکرار رمز جدید</Label>
          <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="w-full">ذخیره رمز</Button>
      </form>
    </div>
  );
}
