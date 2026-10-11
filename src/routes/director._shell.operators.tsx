import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Ban, X } from "lucide-react";
import { toast } from "sonner";
import {
  listOperators,
  setMaxOperators,
  setOperatorEnabled,
  setOperatorStatus,
} from "@/lib/operators.functions";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatJalaliDateTime, toFa } from "@/lib/persian";

export const Route = createFileRoute("/director/_shell/operators")({
  component: OperatorsPage,
});

type Row = {
  id: string;
  kind: string;
  device_id: string;
  device_label: string;
  operator_name: string;
  status: string;
  is_enabled: boolean;
  created_at: string;
  last_seen_at: string;
};

function OperatorsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: () => listOperators(),
    refetchInterval: 15000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["operators"] });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const rows = (data.rows ?? []) as Row[];
  const base = (data.publicAppUrl || (typeof window !== "undefined" ? window.location.origin : ""))
    .replace(/\/+$/, "");

  return (
    <>
      <PageTitle title="اپراتورها" />
      <Tabs defaultValue="booth">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="booth">اپراتورهای باجه</TabsTrigger>
          <TabsTrigger value="entry">اپراتورهای کنترل ورود</TabsTrigger>
        </TabsList>
        <TabsContent value="booth" className="mt-4 space-y-4">
          <KindPanel
            kind="booth"
            title="لینک ثابت باجه"
            link={data.boothToken ? `${base}/booth/${data.boothToken}` : ""}
            max={data.maxBooth}
            rows={rows.filter((r) => r.kind === "booth")}
            onlineSince={data.onlineSince}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="entry" className="mt-4 space-y-4">
          <KindPanel
            kind="entry"
            title="لینک ثابت کنترل ورود"
            link={data.entryToken ? `${base}/entry/${data.entryToken}` : ""}
            max={data.maxEntry}
            rows={rows.filter((r) => r.kind === "entry")}
            onlineSince={data.onlineSince}
            refresh={refresh}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function KindPanel({
  kind,
  title,
  link,
  max,
  rows,
  onlineSince,
  refresh,
}: {
  kind: "booth" | "entry";
  title: string;
  link: string;
  max: number;
  rows: Row[];
  onlineSince: string;
  refresh: () => void;
}) {
  const [limit, setLimit] = useState(String(max));
  useEffect(() => setLimit(String(max)), [max]);

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const revoked = rows.filter((r) => r.status === "revoked");
  const online = approved.filter((r) => r.is_enabled && r.last_seen_at >= onlineSince);

  const saveLimit = async () => {
    const value = Number(limit);
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      toast.error("عدد بین ۱ تا ۵۰ وارد کنید.");
      return;
    }
    await setMaxOperators({ data: { kind, max: value } });
    refresh();
    toast.success("محدودیت ذخیره شد.");
  };

  return (
    <>
      <div className="panel p-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          این لینک ثابت است و تغییر نمی‌کند. هر دستگاه جدید با باز کردن آن، درخواست دسترسی می‌فرستد.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-secondary p-3 text-xs" dir="ltr">
            {link || "ابتدا نشانی عمومی سایت را در پنل مدیر ثبت کنید"}
          </code>
          <Button
            size="icon"
            variant="secondary"
            disabled={!link}
            aria-label="کپی لینک"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("لینک کپی شد.");
            }}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            disabled={!link}
            aria-label="باز کردن لینک"
            onClick={() => window.open(link, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>

      <div className="panel flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-xs text-muted-foreground">اپراتورهای متصل هم‌اکنون</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {toFa(online.length)} / {toFa(max)}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">حداکثر اپراتورهای همزمان</p>
            <Input
              dir="ltr"
              className="w-24"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <Button onClick={() => void saveLimit()}>ذخیره</Button>
        </div>
      </div>

      <OperatorTable
        title="درخواست‌های جدید"
        rows={pending}
        empty="درخواست جدیدی وجود ندارد."
        onlineSince={onlineSince}
        refresh={refresh}
      />
      <OperatorTable
        title="اپراتورهای تأییدشده"
        rows={approved}
        empty="هنوز اپراتوری تأیید نشده است."
        onlineSince={onlineSince}
        refresh={refresh}
      />
      {revoked.length > 0 ? (
        <OperatorTable
          title="دسترسی‌های لغوشده"
          rows={revoked}
          empty=""
          onlineSince={onlineSince}
          refresh={refresh}
        />
      ) : null}
    </>
  );
}

function OperatorTable({
  title,
  rows,
  empty,
  onlineSince,
  refresh,
}: {
  title: string;
  rows: Row[];
  empty: string;
  onlineSince: string;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(id);
    try {
      await fn();
      refresh();
      toast.success(message);
    } catch {
      toast.error("عملیات ناموفق بود.");
    }
    setBusy(null);
  };

  return (
    <div className="panel p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOnline = r.status === "approved" && r.is_enabled && r.last_seen_at >= onlineSince;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-40">
                  <p className="font-medium">
                    {r.operator_name}
                    {isOnline ? (
                      <Badge variant="secondary" className="ms-2 text-[10px]">
                        متصل
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.device_label || "دستگاه نامشخص"} • {formatJalaliDateTime(r.created_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} enabled={r.is_enabled} />

                  {r.status === "approved" ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      فعال
                      <Switch
                        checked={r.is_enabled}
                        disabled={busy === r.id}
                        onCheckedChange={(v) =>
                          void act(
                            r.id,
                            () => setOperatorEnabled({ data: { id: r.id, enabled: v } }),
                            v ? "دسترسی فعال شد." : "دسترسی غیرفعال شد.",
                          )
                        }
                      />
                    </label>
                  ) : null}

                  {r.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() =>
                          void act(
                            r.id,
                            () => setOperatorStatus({ data: { id: r.id, status: "approved" } }),
                            "دسترسی تأیید شد.",
                          )
                        }
                      >
                        <Check className="size-4" /> تأیید
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy === r.id}
                        onClick={() =>
                          void act(
                            r.id,
                            () => setOperatorStatus({ data: { id: r.id, status: "revoked" } }),
                            "درخواست رد شد.",
                          )
                        }
                      >
                        <X className="size-4" /> رد
                      </Button>
                    </>
                  ) : null}

                  {r.status === "approved" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy === r.id}
                      onClick={() =>
                        void act(
                          r.id,
                          () => setOperatorStatus({ data: { id: r.id, status: "revoked" } }),
                          "دسترسی لغو شد.",
                        )
                      }
                    >
                      <Ban className="size-4" /> لغو دسترسی
                    </Button>
                  ) : null}

                  {r.status === "revoked" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === r.id}
                      onClick={() =>
                        void act(
                          r.id,
                          () => setOperatorStatus({ data: { id: r.id, status: "approved" } }),
                          "دسترسی بازگردانده شد.",
                        )
                      }
                    >
                      بازگرداندن دسترسی
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (status === "pending") return <Badge variant="outline">در انتظار تأیید</Badge>;
  if (status === "revoked") return <Badge variant="destructive">لغو شده</Badge>;
  return enabled ? <Badge>تأییدشده</Badge> : <Badge variant="outline">غیرفعال</Badge>;
}
