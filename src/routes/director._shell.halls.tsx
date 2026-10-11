import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Power, Trash2, Type, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/halls")({
  head: () => ({
    meta: [
      { title: "سالن‌های من | پنل کارگردان" },
      { name: "description", content: "مدیریت سالن‌های کارگردان: ساخت، تغییر نام، طراحی و حذف." },
      { property: "og:title", content: "سالن‌های من" },
      { property: "og:description", content: "مدیریت سالن‌های کارگردان." },
    ],
  }),
  component: DirectorHalls,
});

function DirectorHalls() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["halls", userId],
    queryFn: async () => {
      const { data: halls } = await supabase
        .from("halls")
        .select("*")
        .eq("director_id", userId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const ids = (halls ?? []).map((h) => h.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: seats } = await supabase.from("seats").select("hall_id").in("hall_id", ids).gt("number", 0).eq("is_active", true);
        (seats ?? []).forEach((s) => counts.set(s.hall_id, (counts.get(s.hall_id) ?? 0) + 1));
      }
      return (halls ?? []).map((h) => ({ ...h, seatCount: counts.get(h.id) ?? 0 }));
    },
    enabled: !!userId,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["halls"] });
    void qc.invalidateQueries({ queryKey: ["my-halls-lite"] });
    void qc.invalidateQueries({ queryKey: ["my-shows"] });
    void qc.invalidateQueries({ queryKey: ["my-sessions"] });
  };

  const create = async () => {
    if (!userId || name.trim().length < 2) {
      toast.error("نام سالن را وارد کنید.");
      return;
    }
    const { error } = await supabase.from("halls").insert({ name: name.trim(), director_id: userId });
    if (error) toast.error("ثبت سالن ناموفق بود.");
    else {
      toast.success("سالن ساخته شد.");
      setName("");
      refresh();
    }
  };

  const rename = async () => {
    if (!edit) return;
    const n = edit.name.trim();
    if (n.length < 2) return void toast.error("نام سالن را وارد کنید.");
    const { error } = await supabase.from("halls").update({ name: n }).eq("id", edit.id);
    if (error) return void toast.error("تغییر نام ناموفق بود.");
    toast.success("نام سالن ویرایش شد.");
    setEdit(null);
    refresh();
  };

  const remove = async () => {
    if (!delId) return;
    const { data: r, error } = await supabase.rpc("delete_hall", { _hall: delId });
    if (error) return void toast.error("حذف سالن ناموفق بود.");
    toast.success(
      r === "archived" ? "سالن حذف شد. سوابق فروش و بلیت‌های قبلی برای گزارش‌ها حفظ شدند." : "سالن حذف شد.",
    );
    setDelId(null);
    refresh();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("halls").update({ is_active: !active }).eq("id", id);
    refresh();
  };

  return (
    <>
      <PageTitle title="سالن‌های من" />
      <div className="panel mb-5 flex flex-wrap items-center gap-3 p-4">
        <Input placeholder="نام سالن جدید" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Button onClick={create} className="gap-2">
          <Plus className="size-4" /> افزودن سالن
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((h) => (
          <div key={h.id} className="panel flex flex-col gap-3 p-4">
            {edit?.id === h.id ? (
              <div className="flex items-center gap-2">
                <Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <Button size="icon" onClick={() => void rename()} aria-label="ذخیره نام">
                  <Check className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEdit(null)} aria-label="انصراف">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div>
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {toFa(h.seatCount)} صندلی • {h.is_active ? "فعال" : "غیرفعال"}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-1">
                <Link to="/director/halls/$hallId" params={{ hallId: h.id }}>
                  <Pencil className="size-4" /> طراحی
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEdit({ id: h.id, name: h.name })}>
                <Type className="size-4" /> ویرایش نام سالن
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggle(h.id, h.is_active)}>
                <Power className="size-4" /> {h.is_active ? "غیرفعال" : "فعال"}
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setDelId(h.id)}>
                <Trash2 className="size-4" /> حذف سالن
              </Button>
            </div>
          </div>
        ))}
      </div>
      {(data ?? []).length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">هنوز سالنی نساخته‌اید.</p>
      ) : null}

      <ConfirmDeleteDialog
        open={!!delId}
        title="حذف سالن"
        message="آیا از حذف این سالن مطمئن هستید؟"
        onCancel={() => setDelId(null)}
        onConfirm={remove}
      />
    </>
  );
}
