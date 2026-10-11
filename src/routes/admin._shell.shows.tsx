import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/AppShell";
import { dateStrToJalali, money, toFa } from "@/lib/persian";

export const Route = createFileRoute("/admin/_shell/shows")({
  component: AdminShows,
});

function AdminShows() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-shows"],
    queryFn: async () => {
      const { data: shows } = await supabase
        .from("shows")
        .select("*, halls(name), profiles:director_id(full_name)")
        .order("created_at", { ascending: false });
      const ids = (shows ?? []).map((s) => s.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: sessions } = await supabase
          .from("show_sessions")
          .select("id,show_id")
          .in("show_id", ids);
        (sessions ?? []).forEach((s) =>
          counts.set(s.show_id, (counts.get(s.show_id) ?? 0) + 1),
        );
      }
      return (shows ?? []).map((s) => ({ ...s, sessionCount: counts.get(s.id) ?? 0 }));
    },
  });

  return (
    <>
      <PageTitle title="نمایش‌ها" />
      {isLoading ? <p className="text-sm text-muted-foreground">در حال بارگذاری…</p> : null}
      {!isLoading && (data ?? []).length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">هنوز نمایشی ثبت نشده است.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((s) => (
          <div key={s.id} className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{s.title}</p>
              <span
                className={
                  "rounded-full px-3 py-1 text-xs " +
                  (s.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground")
                }
              >
                {s.is_active ? "فعال" : "غیرفعال"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              کارگردان: {(s.profiles as { full_name: string } | null)?.full_name ?? "—"} • سالن:{" "}
              {(s.halls as { name: string } | null)?.name ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              از {dateStrToJalali(s.start_date)} تا {dateStrToJalali(s.end_date)} • سانس‌ها:{" "}
              {toFa(s.sessionCount)}
            </p>
            <p className="mt-2 text-sm text-primary">{money(Number(s.price))}</p>
          </div>
        ))}
      </div>
    </>
  );
}
