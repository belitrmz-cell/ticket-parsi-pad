import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { boothFindTicket, boothRefundTicket } from "@/lib/booth.functions";
import { formatJalaliDateTime, money, toFa } from "@/lib/persian";

type Auth = { token: string; deviceId: string; sessionToken: string };
type T = NonNullable<Awaited<ReturnType<typeof boothFindTicket>>>;

export function BoothTicketCheck({ auth, onRefunded }: { auth: Auth; onRefunded: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState<T | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lock = useRef(false);

  const find = async (c: string) => {
    if (c.trim().length < 4) return;
    setBusy(true);
    try {
      const r = await boothFindTicket({ data: { ...auth, code: c } });
      if (r) { setT(r); setNotFound(false); setScanning(false); }
      else { setNotFound(true); toast.error("بلیتی با این کد پیدا نشد"); }
    } catch { toast.error("خطا در استعلام بلیت"); }
    finally { setBusy(false); lock.current = false; }
  };

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    const c = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = videoRef.current;
        if (!v || stop) return;
        v.srcObject = stream;
        await v.play();
        const loop = () => {
          if (stop) return;
          if (!lock.current && v.videoWidth) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const val = jsQR(img.data, img.width, img.height)?.data;
            if (val) { lock.current = true; setCode(val); void find(val); }
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { toast.error("دسترسی به دوربین ممکن نیست"); setScanning(false); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const close = (rescan: boolean) => { setT(null); setCode(""); if (rescan) setScanning(true); };
  const refund = async () => {
    if (!t) return;
    setBusy(true);
    try {
      await boothRefundTicket({ data: { ...auth, ticketId: t.id } });
      toast.success("بلیت مسترد شد و صندلی آزاد شد");
      onRefunded();
      close(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  };

  const state = !t ? "" : t.status !== "sold" ? "مسترد / باطل" : t.entered ? "استفاده‌شده (وارد سالن شده)" : "معتبر — وارد سالن نشده";
  const canRefund = !!t && t.status === "sold" && !t.entered;
  return (
    <div className="panel space-y-3">
      <div className="font-bold">استعلام و استرداد بلیت</div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" dir="ltr" placeholder="کد بلیت" value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void find(code)} />
        <Button disabled={busy} onClick={() => void find(code)}>استعلام</Button>
        <Button variant="outline" onClick={() => setScanning((s) => !s)}>{scanning ? "توقف اسکن" : "اسکن با دوربین"}</Button>
      </div>
      {scanning && (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg border border-border">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary" />
        </div>
      )}
      {notFound && <p className="text-sm text-destructive">بلیتی با این کد پیدا نشد (ممکن است مسترد شده باشد).</p>}

      <Dialog open={!!t} onOpenChange={(o) => !o && close(false)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>بلیت پیدا شد</DialogTitle></DialogHeader>
          {t && (
            <div className="space-y-2 text-sm">
              <div>وضعیت: <b>{state}</b></div>
              <div>{t.show_title} — {t.hall_name}</div>
              <div>{formatJalaliDateTime(t.starts_at)}</div>
              <div>{t.section_name} ردیف {t.row_label} صندلی {toFa(t.seat_number)} — {money(Number(t.price))}</div>
              {canRefund ? (
                <p className="pt-2 font-semibold">آیا می‌خواهید این بلیت مسترد شده و صندلی آن بلافاصله آزاد شود؟</p>
              ) : (
                <p className="pt-2 text-destructive">این بلیت قابل استرداد نیست.</p>
              )}
              <div className="flex gap-2 pt-2">
                {canRefund && <Button variant="destructive" disabled={busy} onClick={() => void refund()}>تایید استرداد</Button>}
                <Button variant="secondary" disabled={busy} onClick={() => close(true)}>{canRefund ? "رد / انصراف" : "اسکن بعدی"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
