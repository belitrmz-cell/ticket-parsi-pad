import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setDirectorState } from "@/lib/auth.functions";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatJalaliDate, toFa } from "@/lib/persian";

export const Route = createFileRoute("/admin/_shell/requests")({
  component: Requests,
});

function Requests() {
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["director-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: (vars: { directorId: string; status: "approved" | "rejected" }) =>
      setDirectorState({ data: vars }),
    onSuccess: () => {
      toast.success("درخواست بررسی شد.");
      void qc.invalidateQueries({ queryKey: ["director-requests"] });
      void qc.invalidateQueries({ queryKey: ["directors"] });
    },
    onError: () => toast.error("انجام عملیات ناموفق بود."),
  });

  return (
    <>
      <PageTitle title="درخواست‌های ثبت‌نام" />
      {isLoading ? <p className="text-sm text-muted-foreground">در حال بارگذاری…</p> : null}
      {!isLoading && (requests ?? []).length === 0 ? (
        <p className="panel p-6 text-sm text-muted-foreground">درخواست بررسی‌نشده‌ای وجود ندارد.</p>
      ) : null}
      <div className="space-y-3">
        {(requests ?? []).map((d) => (
          <div key={d.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{d.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {d.username} • {toFa(d.mobile)} • {d.email}
              </p>
              <p className="text-xs text-muted-foreground">{formatJalaliDate(d.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act.mutate({ directorId: d.id, status: "approved" })}>
                تأیید
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => act.mutate({ directorId: d.id, status: "rejected" })}
              >
                رد
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
