import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { getDirectorLinkToken, setPublicAppUrl } from "@/lib/auth.functions";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPanelIcon, type PanelKey } from "@/lib/panel-icons.functions";
import { usePanelIcons } from "@/components/PanelIcon";
import { AdminAccountSettings } from "@/components/AdminAccountSettings";

export const Route = createFileRoute("/admin/_shell/settings")({
  component: AdminSettings,
});

/** Editor/preview hosts require Lovable project access, so links must not use them. */
function isPrivateHost(host: string) {
  return (
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.endsWith("-dev.lovable.app") ||
    host === "localhost" ||
    host.startsWith("127.")
  );
}

function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["director-link"],
    queryFn: () => getDirectorLinkToken(),
  });

  const [base, setBase] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.publicAppUrl) setBase(data.publicAppUrl);
    else if (typeof window !== "undefined" && !isPrivateHost(window.location.hostname))
      setBase(window.location.origin);
  }, [data?.publicAppUrl]);

  const url = base && data?.token ? `${base.replace(/\/+$/, "")}/director-access/${data.token}` : "";

  const save = async () => {
    setSaving(true);
    try {
      await setPublicAppUrl({ data: { url: base.trim().replace(/\/+$/, "") } });
      await qc.invalidateQueries({ queryKey: ["director-link"] });
      toast.success("نشانی سایت ذخیره شد.");
    } catch {
      toast.error("نشانی معتبر نیست.");
    }
    setSaving(false);
  };

  return (
    <>
      <PageTitle title="تنظیمات" />
      <AdminAccountSettings />
      <div className="panel p-5">
        <h2 className="font-semibold">لینک ثابت کارگردان</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          این تنها لینک ثبت‌نام و ورود کارگردان‌هاست و ثابت می‌ماند. برای اینکه لینک برای افراد بیرون
          از تیم هم باز شود، باید نشانی عمومی سایت (نشانی منتشرشده یا دامنه اختصاصی) در کادر زیر ثبت
          شود.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="base">نشانی عمومی سایت</Label>
          <div className="flex items-center gap-2">
            <Input
              id="base"
              dir="ltr"
              placeholder="https://example.com"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
            <Button onClick={() => void save()} disabled={saving}>
              ذخیره
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-secondary p-3 text-xs" dir="ltr">
            {url || "ابتدا نشانی عمومی سایت را ثبت کنید"}
          </code>
          <Button
            size="icon"
            variant="secondary"
            disabled={!url}
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("لینک کپی شد.");
            }}
            aria-label="کپی لینک"
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </div>


      <PanelIconsSettings />
    </>
  );
}

const PANELS: { key: PanelKey; label: string }[] = [
  { key: "admin", label: "پنل مدیر" },
  { key: "director", label: "پنل کارگردان" },
  { key: "booth", label: "پنل باجه فروش" },
  { key: "entry", label: "پنل کنترل ورود" },
];

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      const r = Math.max(size / img.width, size / img.height);
      const w = img.width * r, h = img.height * r;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function PanelIconsSettings() {
  const qc = useQueryClient();
  const { data } = usePanelIcons();
  const [busy, setBusy] = useState<PanelKey | null>(null);

  const save = async (panel: PanelKey, value: string) => {
    setBusy(panel);
    try {
      await setPanelIcon({ data: { panel, value } });
      await qc.invalidateQueries({ queryKey: ["panel-icons"] });
      toast.success(value ? "آیکون ذخیره شد." : "آیکون حذف شد.");
    } catch {
      toast.error("ذخیره آیکون ناموفق بود.");
    }
    setBusy(null);
  };

  return (
    <div className="panel mt-4 p-5">
      <h2 className="font-semibold">آیکون پنل‌ها</h2>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        برای هر پنل یک تصویر بارگذاری کنید تا در بالای همان پنل نمایش داده شود.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PANELS.map((p) => (
          <div key={p.key} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {data?.[p.key] ? (
                <img src={data[p.key]} alt={p.label} className="size-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground">بدون آیکون</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{p.label}</p>
              <div className="mt-2 flex gap-2">
                <Button asChild size="sm" variant="outline" disabled={busy === p.key}>
                  <label className="cursor-pointer">
                    بارگذاری
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          await save(p.key, await resizeToDataUrl(f));
                        } catch {
                          toast.error("فایل تصویر معتبر نیست.");
                        }
                      }}
                    />
                  </label>
                </Button>
                {data?.[p.key] ? (
                  <Button size="sm" variant="ghost" disabled={busy === p.key} onClick={() => void save(p.key, "")}>
                    حذف
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
