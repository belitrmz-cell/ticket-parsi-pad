import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { boothListTickets, boothRefundTicket } from "@/lib/booth.functions";
import { formatJalaliDate, formatJalaliDateTime, formatTime, money, toFa } from "@/lib/persian";

type Auth = { token: string; deviceId: string; sessionToken: string };
const STATUS: Record<string, string> = { sold: "فروخته‌شده", cancelled: "مسترد / لغوشده" };
type E = { entered_at: string } | { entered_at: string }[] | null | undefined;
const entryOf = (e: E) => (Array.isArray(e) ? (e[0] ?? null) : (e ?? null));
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function BoothTicketList({ auth }: { auth: Auth }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [showId, setShowId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [entry, setEntry] = useState<"" | "in" | "out">("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["booth-tickets", auth.sessionToken],
    queryFn: () => boothListTickets({ data: auth }),
  });
  const tickets = data ?? [];
  const shows = useMemo(
    () => Array.from(new Map(tickets.map((t) => [t.show_sessions?.show_id ?? "", t.show_title])).entries()),
    [tickets],
  );
  const sessions = useMemo(
    () =>
      Array.from(
        new Map(tickets.filter((t) => !showId || t.show_sessions?.show_id === showId).map((t) => [t.session_id, t.starts_at])).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [tickets, showId],
  );
  const q = code.trim().toLowerCase();
  const list = tickets.filter((t) => {
    const entered = !!entryOf(t.entries);
    if (q && !t.code.toLowerCase().includes(q)) return false;
    if (showId && t.show_sessions?.show_id !== showId) return false;
    if (sessionId && t.session_id !== sessionId) return false;
    if (day && localDateStr(new Date(t.starts_at)) !== day) return false;
    if (entry === "in" && !entered) return false;
    if (entry === "out" && entered) return false;
    return true;
  });
  const viewed = tickets.find((t) => t.id === viewId);

  const refund = async () => {
    if (!viewed || !confirm("بلیت مسترد و صندلی آزاد شود؟")) return;
    setBusy(true);
    try {
      await boothRefundTicket({ data: { ...auth, ticketId: viewed.id } });
      toast.success("بلیت مسترد شد و صندلی آزاد شد");
      setViewId(null);
      void qc.invalidateQueries({ queryKey: ["booth-tickets"] });
      void qc.invalidateQueries({ queryKey: ["booth-map"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  };

  const sel = "h-10 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <>
      <h2 className="mb-4 text-xl font-bold">بلیت‌ها</h2>
      <div className="panel mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input dir="ltr" placeholder="جستجو با کد بلیت" value={code} onChange={(e) => setCode(e.target.value)} />
        <select className={sel} value={showId} onChange={(e) => { setShowId(e.target.value); setSessionId(""); }}>
          <option value="">همه نمایش‌ها</option>
          {shows.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <select className={sel} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">همه سانس‌ها</option>
          {sessions.map(([id, at]) => <option key={id} value={id}>{formatJalaliDateTime(at)}</option>)}
        </select>
        <JalaliDatePicker value={day} onChange={setDay} clearable placeholder="تاریخ سانس" />
        <select className={sel} value={entry} onChange={(e) => setEntry(e.target.value as "" | "in" | "out")}>
          <option value="">وضعیت ورود: همه</option>
          <option value="in">واردشده</option>
          <option value="out">واردنشده</option>
        </select>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{toFa(list.length)} بلیت</p>
      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {["کد بلیت", "نمایش", "تاریخ سانس", "ساعت", "سالن", "ردیف", "صندلی", "وضعیت", "ورود", "تاریخ فروش", ""].map((h) => (
                <th key={h} className="p-2 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const entered = !!entryOf(t.entries);
              return (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-2 font-mono" dir="ltr">{t.code}</td>
                  <td className="p-2">{t.show_title}</td>
                  <td className="p-2">{formatJalaliDate(t.starts_at)}</td>
                  <td className="p-2">{formatTime(t.starts_at)}</td>
                  <td className="p-2">{t.hall_name}</td>
                  <td className="p-2">{t.row_label}</td>
                  <td className="p-2">{toFa(t.seat_number)}</td>
                  <td className="p-2">{STATUS[t.status] ?? t.status}</td>
                  <td className={`p-2 ${entered ? "text-primary" : "text-muted-foreground"}`}>{entered ? "واردشده" : "واردنشده"}</td>
                  <td className="p-2">{formatJalaliDate(t.created_at)}</td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setViewId(t.id)}>
                      <Eye className="size-4" /> جزئیات
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading ? <p className="p-6 text-sm text-muted-foreground">در حال بارگذاری…</p> : null}
        {!isLoading && list.length === 0 ? <p className="p-6 text-sm text-muted-foreground">بلیتی پیدا نشد.</p> : null}
      </div>

      <Dialog open={!!viewed} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>جزئیات بلیت</DialogTitle></DialogHeader>
          {viewed ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5 text-sm">
                  <p>کد بلیت: <b dir="ltr" className="font-mono">{viewed.code}</b></p>
                  <p>نمایش: {viewed.show_title}</p>
                  <p>تاریخ و ساعت سانس: {formatJalaliDateTime(viewed.starts_at)}</p>
                  <p>سالن: {viewed.hall_name}</p>
                  <p>ردیف {viewed.row_label} — صندلی {toFa(viewed.seat_number)}</p>
                  <p>مبلغ: {money(Number(viewed.price))}</p>
                  <p>وضعیت فروش: {STATUS[viewed.status] ?? viewed.status}</p>
                  <p>شماره فروش: {toFa(viewed.transactions?.serial ?? "")} • اپراتور: {viewed.transactions?.operator_name || "—"}</p>
                  <p>تاریخ فروش: {formatJalaliDateTime(viewed.created_at)}</p>
                  <p>وضعیت ورود: {entryOf(viewed.entries) ? `واردشده (${formatJalaliDateTime(entryOf(viewed.entries)!.entered_at)})` : "واردنشده"}</p>
                </div>
                <Qr value={viewed.qr_token} />
              </div>
              {viewed.status === "sold" && !entryOf(viewed.entries) ? (
                <Button variant="destructive" disabled={busy} onClick={() => void refund()}>بازگشت بلیت و آزادسازی صندلی</Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void QRCode.toDataURL(value, { width: 180, margin: 1 }).then(setSrc); }, [value]);
  return src ? <img src={src} alt="QR بلیت" className="size-44 rounded-md bg-background" /> : null;
}
