import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { boothListRefunds } from "@/lib/booth.functions";
import { formatJalaliDateTime, money, toFa } from "@/lib/persian";

type Auth = { token: string; deviceId: string; sessionToken: string };

export function BoothRefundedTickets({ auth }: { auth: Auth }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["booth-tickets", "refunds", auth.sessionToken],
    queryFn: () => boothListRefunds({ data: auth }),
  });
  const all = data ?? [];
  const s = q.trim().toLowerCase();
  const list = all.filter((t) =>
    !s || t.customerName.toLowerCase().includes(s) || t.customerMobile.includes(s) ||
    t.showTitle.toLowerCase().includes(s) || String(t.serial).includes(s));
  const total = all.reduce((n, t) => n + t.price, 0);

  return (
    <>
      <h2 className="mb-4 text-xl font-bold">بلیت‌های استردادشده</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="panel p-4"><p className="text-xs text-muted-foreground">تعداد استرداد</p><p className="text-2xl font-bold">{toFa(all.length)}</p></div>
        <div className="panel p-4"><p className="text-xs text-muted-foreground">مجموع مبلغ برگشتی</p><p className="text-2xl font-bold">{money(total)}</p></div>
      </div>
      <Input className="mb-4" placeholder="جستجو با نام، موبایل، نمایش یا سریال" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <p className="text-muted-foreground">در حال بارگذاری…</p>
        : !list.length ? <p className="text-muted-foreground">بلیت استردادشده‌ای یافت نشد.</p>
        : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground"><tr className="border-b border-border">
                {["خریدار", "شماره تماس", "نمایش و سانس", "صندلی", "مبلغ", "سریال", "وضعیت صندلی"].map((h) =>
                  <th key={h} className="p-3 text-right font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="p-3">{t.customerName || "—"}</td>
                    <td className="p-3" dir="ltr">{t.customerMobile ? <a href={`tel:${t.customerMobile}`} className="text-primary">{toFa(t.customerMobile)}</a> : "—"}</td>
                    <td className="p-3">{t.showTitle}<div className="text-xs text-muted-foreground">{t.hallName} · {formatJalaliDateTime(t.startsAt)}</div></td>
                    <td className="p-3">ردیف {t.rowLabel} · {toFa(t.seatNumber)}</td>
                    <td className="p-3">{money(t.price)}</td>
                    <td className="p-3">{toFa(t.serial)}</td>
                    <td className="p-3">{t.resold ? <span className="text-destructive">فروخته‌شدهٔ مجدد</span> : <span className="text-primary">آزاد</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
