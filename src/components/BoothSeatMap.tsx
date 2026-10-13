import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  boothGetPrintSize, boothGetSwitch, boothSeatMap, boothSell, boothSessions, SALE_LOCKED_MESSAGE, boothSetPrintSize, boothSetSwitch,
  type SoldTicket,
} from "@/lib/booth.functions";
import { PRINT_SIZE_LABELS, printTickets, type PrintSize } from "@/lib/ticket-print";
import { SWITCH_OPTIONS } from "@/lib/session-switch";

function switchLabel(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${toFa(r)} دقیقه`;
  return r ? `${toFa(h)} ساعت و ${toFa(r)} دقیقه` : `${toFa(h)} ساعت`;
}
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OBJECT_COLORS, SEAT_SIZE } from "@/lib/hall";
import { formatJalaliDateTime, formatTime, money, toFa } from "@/lib/persian";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";

type Auth = { token: string; deviceId: string; sessionToken: string };

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() {
  return localDateStr(new Date());
}

const FREE = "oklch(0.72 0.15 85)";
const PICK = "oklch(0.65 0.15 145)";
const SOLD = "oklch(0.62 0.16 25)";
const OFF = "oklch(0.4 0 0)";

/** Booth seat map: renders the hall exactly as saved by the hall designer, plus sale status. */
export function BoothSeatMap({ auth }: { auth: Auth }) {
  const [sessionId, setSessionId] = useState("");
  const [showId, setShowId] = useState("");
  const [day, setDay] = useState(todayStr());
  const [picked, setPicked] = useState<string[]>([]);
  // Same initial viewport as the hall designer (zoom 1, pan 0) — no auto-fit.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selling, setSelling] = useState(false);
  type Sale = { serial: number; total: number; operatorName: string; tickets: SoldTicket[] };
  const [sale, setSale] = useState<Sale | null>(null);
  const printSize = useQuery({
    queryKey: ["booth-print-size", auth.deviceId],
    queryFn: () => boothGetPrintSize({ data: auth }) as Promise<PrintSize>,
  });
  const size: PrintSize = printSize.data ?? "standard";
  const switchMin = useQuery({
    queryKey: ["booth-switch", auth.deviceId],
    queryFn: () => boothGetSwitch({ data: auth }),
  });
  const changeSwitch = async (m: number) => {
    qc.setQueryData(["booth-switch", auth.deviceId], m);
    try {
      await boothSetSwitch({ data: { ...auth, minutes: m } });
      toast.success("زمان سوئیچ سانس ذخیره شد.");
    } catch {
      toast.error("ذخیره انجام نشد.");
      void switchMin.refetch();
    }
  };
  const changeSize = async (v: PrintSize) => {
    qc.setQueryData(["booth-print-size", auth.deviceId], v);
    try {
      await boothSetPrintSize({ data: { ...auth, size: v } });
    } catch {
      toast.error("ذخیره سایز چاپ ناموفق بود.");
      void printSize.refetch();
    }
  };
  const doPrint = async (list: SoldTicket[]) => {
    if (!sale) return;
    try {
      await printTickets(list, size, { saleSerial: sale.serial, operatorName: sale.operatorName });
    } catch {
      toast.error("پنجره چاپ باز نشد؛ اجازه باز شدن پنجره را بدهید.");
    }
  };
  const sell = async () => {
    setSelling(true);
    try {
      const r = await boothSell({ data: { ...auth, sessionId, seatIds: picked } });
      if (!r.ok) {
        toast.error(r.error);
        setConfirmOpen(false);
        setPicked([]);
      } else {
        setSale(r.sale);
        setConfirmOpen(false);
        setPicked([]);
        toast.success("فروش ثبت شد.");
      }
    } catch {
      toast.error("ثبت فروش ناموفق بود.");
    }
    setSelling(false);
    void map.refetch();
  };

  const sessions = useQuery({
    queryKey: ["booth-sessions", auth.deviceId],
    queryFn: () => boothSessions({ data: auth }),
  });
  const map = useQuery({
    queryKey: ["booth-map", sessionId],
    queryFn: () => boothSeatMap({ data: { ...auth, sessionId } }),
    enabled: !!sessionId,
    refetchInterval: 15000,
  });

  const sold = new Set(map.data?.soldSeatIds ?? []);
  const rowLabel = new Map((map.data?.rows ?? []).map((r) => [r.id, r.label]));
  const current = sessions.data?.find((s) => s.id === sessionId);
  const shows = Array.from(
    new Map((sessions.data ?? []).map((s) => [s.showId, { id: s.showId, title: s.title }])).values(),
  );
  const daySessions = (sessions.data ?? []).filter(
    (s) => s.showId === showId && localDateStr(new Date(s.startsAt)) === day,
  );
  const pickedSeats = (map.data?.seats ?? []).filter((s) => picked.includes(s.id));
  const rowPrice = new Map((map.data?.rows ?? []).map((r) => [r.id, r.price]));
  const seatPrice = (rowId: string) => Number(rowPrice.get(rowId) ?? current?.price ?? 0);
  const pickedTotal = pickedSeats.reduce((sum, s) => sum + seatPrice(s.row_id), 0);

  const toggle = (id: string, active: boolean) => {
    if (map.data && !map.data.canSell) { toast.error(SALE_LOCKED_MESSAGE, { id: "sale-locked" }); return; }
    if (!active || sold.has(id)) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="panel space-y-3 p-4">
        {sessions.isLoading ? (
          <Loader2 className="size-5 animate-spin text-primary" />
        ) : shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">سانس فعالی وجود ندارد.</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-semibold">انتخاب نمایش</label>
              <select
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                value={showId}
                onChange={(e) => {
                  setShowId(e.target.value);
                  setDay(todayStr());
                  setSessionId("");
                  setPicked([]);
                }}
              >
                <option value="">— انتخاب نمایش —</option>
                {shows.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            {showId ? (
              <div>
                <label className="mb-1 block text-sm font-semibold">تاریخ</label>
                <JalaliDatePicker
                  value={day}
                  onChange={(v) => {
                    setDay(v ?? todayStr());
                    setSessionId("");
                    setPicked([]);
                  }}
                />
              </div>
            ) : null}
            {showId ? (
              <div>
                <label className="mb-1 block text-sm font-semibold">انتخاب سانس</label>
                {daySessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">برای این تاریخ سانسی تعریف نشده است.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySessions.map((s, i) => (
                      <Button
                        key={s.id}
                        type="button"
                        variant={s.id === sessionId ? "default" : "outline"}
                        onClick={() => {
                          setSessionId(s.id);
                          setPicked([]);
                        }}
                      >
                        سانس {toFa(i + 1)} • {formatTime(s.startsAt)} • {s.hallName}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Printer className="size-4 text-muted-foreground" />
          <span>سایز چاپ بلیت:</span>
          <select
            className="rounded-md border border-input bg-background p-1.5 text-sm"
            value={size}
            disabled={printSize.isLoading}
            onChange={(e) => void changeSize(e.target.value as PrintSize)}
          >
            {(Object.keys(PRINT_SIZE_LABELS) as PrintSize[]).map((k) => (
              <option key={k} value={k}>{PRINT_SIZE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>زمان فعال‌سازی خودکار سانس بعد جهت اسکن بلیت:</span>
            <select
              className="rounded-md border border-input bg-background p-1.5 text-sm"
              value={switchMin.data ?? 60}
              disabled={switchMin.isLoading}
              onChange={(e) => void changeSwitch(Number(e.target.value))}
            >
              {SWITCH_OPTIONS.map((m) => (
                <option key={m} value={m}>{switchLabel(m)} بعد از شروع سانس</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            گیت‌های ورودی سالن، این مدت پس از شروع هر سانس، به‌طور خودکار روی سانس بعدی سوئیچ می‌شوند.
          </p>
        </div>
      </div>

      {sessionId ? (
        <div className="panel overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-3 text-xs">
            <Legend color={FREE} label="آزاد" />
            <Legend color={PICK} label="انتخاب‌شده" />
            <Legend color={SOLD} label="فروخته‌شده" />
            <Legend color={OFF} label="غیرفعال" />
            <div className="ms-auto flex gap-1">
              <button className="rounded border px-2" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
              <button className="rounded border px-2" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>−</button>
            </div>
          </div>
          {map.isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : (
            <svg
              className="h-[60vh] w-full bg-muted/20"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => (panRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY, moved: false })}
              onPointerMove={(e) => {
                const p = panRef.current;
                if (!p) return;
                const dx = e.clientX - p.px, dy = e.clientY - p.py;
                if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true;
                if (p.moved) setPan({ x: p.x + dx, y: p.y + dy });
              }}
              onPointerUp={() => setTimeout(() => (panRef.current = null), 0)}
              onPointerLeave={() => (panRef.current = null)}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {(map.data?.objects ?? []).map((o) => (
                  <g key={o.id}>
                    <rect x={o.x} y={o.y} width={o.width} height={o.height} rx={o.kind === "aisle" ? 6 : 10}
                      fill={OBJECT_COLORS[o.kind] ?? OBJECT_COLORS["other"]}
                      fillOpacity={o.kind === "aisle" ? 0.18 : 0.25}
                      stroke={OBJECT_COLORS[o.kind] ?? OBJECT_COLORS["other"]}
                      strokeDasharray={o.kind === "aisle" ? "6 4" : undefined} strokeWidth={1.5} />
                    <text x={o.x + o.width / 2} y={o.y + o.height / 2 + 5} fontSize={13} textAnchor="middle" fill="currentColor">{o.label}</text>
                  </g>
                ))}
                {(map.data?.rows ?? []).map((r) => (
                  <text key={r.id} x={r.x - 22} y={r.y + 5} fontSize={13} fill="currentColor">{r.label}</text>
                ))}
                {(map.data?.seats ?? []).map((s) => {
                  const isSold = sold.has(s.id);
                  const isPick = picked.includes(s.id);
                  const fill = !s.is_active ? OFF : isSold ? SOLD : isPick ? PICK : FREE;
                  const clickable = s.is_active && !isSold;
                  return (
                    <g key={s.id} style={{ cursor: clickable ? "pointer" : "not-allowed" }}
                      onClick={() => { if (!panRef.current?.moved) toggle(s.id, s.is_active); }}>
                      <rect x={s.x - SEAT_SIZE / 2} y={s.y - SEAT_SIZE / 2} width={SEAT_SIZE} height={SEAT_SIZE} rx={5}
                        fill={fill} fillOpacity={s.is_active ? 0.9 : 0.4} />
                      <text x={s.x} y={s.y + 3.5} fontSize={9} fontWeight={700} textAnchor="middle"
                        fill={s.is_active ? "oklch(0.15 0.02 85)" : "currentColor"} pointerEvents="none">
                        {toFa(s.number)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
          <div className="border-t border-border p-3 text-sm">
            {pickedSeats.length === 0 ? (
              <span className="text-muted-foreground">صندلی انتخاب نشده است.</span>
            ) : (
              <div className="space-y-1">
                <p>
                  {pickedSeats.map((s) => `ردیف ${rowLabel.get(s.row_id) ?? ""} - صندلی ${toFa(s.number)}`).join("، ")}
                </p>
                <p className="font-semibold">{toFa(pickedSeats.length)} صندلی • {money(pickedTotal)}</p>
                <Button className="mt-2 w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>فروش بلیت</Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={(o) => !selling && setConfirmOpen(o)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تأیید فروش</DialogTitle></DialogHeader>
          <div className="space-y-1.5 text-sm">
            <p>نمایش: <b>{current?.title}</b></p>
            <p>زمان: {current ? formatJalaliDateTime(current.startsAt) : ""}</p>
            <p>سالن: {current?.hallName}</p>
            <ul className="list-inside list-disc">
              {pickedSeats.map((s) => <li key={s.id}>ردیف {rowLabel.get(s.row_id)} — صندلی {toFa(s.number)} — {money(seatPrice(s.row_id))}</li>)}
            </ul>
            <p>تعداد بلیت: {toFa(pickedSeats.length)}</p>
            <p className="font-semibold">مبلغ کل: {money(pickedTotal)}</p>
            <p className="text-muted-foreground">روش پرداخت: خرید در محل / پرداخت در باجه</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button disabled={selling} onClick={() => void sell()}>
              {selling ? <Loader2 className="size-4 animate-spin" /> : null} فروش بلیت
            </Button>
            <Button variant="ghost" disabled={selling} onClick={() => setConfirmOpen(false)}>انصراف</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sale} onOpenChange={(o) => !o && setSale(null)}>
        <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>فروش موفق — {toFa(sale?.tickets.length ?? 0)} بلیت</DialogTitle></DialogHeader>
          {sale ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">شماره فروش {toFa(sale.serial)} • مبلغ {money(sale.total)}</p>
              {sale.tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <span>ردیف {t.rowLabel} — صندلی {toFa(t.seatNumber)} <span dir="ltr" className="text-xs text-muted-foreground">{t.code.toUpperCase()}</span></span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void doPrint([t])}>
                    <Printer className="size-4" /> چاپ
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button className="gap-1" onClick={() => void doPrint(sale.tickets)}>
                  <Printer className="size-4" /> {sale.tickets.length > 1 ? "چاپ همه" : "چاپ بلیت"}
                </Button>
                <Button variant="ghost" onClick={() => setSale(null)}>بستن</Button>
              </div>
              <p className="text-xs text-muted-foreground">سایز چاپ: {PRINT_SIZE_LABELS[size]}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block size-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
