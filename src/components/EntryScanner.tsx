import { PanelIcon } from "@/components/PanelIcon";
import { autoSessionIndex } from "@/lib/session-switch";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Search,
  Settings2,
  Ticket as TicketIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { entryFeed, scanEntry, type ScanResult } from "@/lib/entry.functions";
import { formatJalaliDate, formatJalaliDateTime, formatTime, toFa } from "@/lib/persian";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import jsQR from "jsqr";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Live entry-control screen: camera scan, manual code, and today's entries. */
export function EntryScanner({
  token,
  deviceId,
  sessionToken,
  operatorName,
}: {
  token: string;
  deviceId: string;
  sessionToken: string;
  operatorName: string;
}) {
  const qc = useQueryClient();
  const auth = { token, deviceId, sessionToken };

  const [date, setDate] = useState<string>(todayStr());
  const [manualMode, setManualMode] = useState(false);
  const [manualPick, setManualPick] = useState<{ id: string; autoId: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const feed = useQuery({
    queryKey: ["entry-feed", deviceId, date],
    queryFn: () => {
      const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
      const start = new Date(y, m - 1, d);
      const end = new Date(y, m - 1, d + 1);
      return entryFeed({ data: { ...auth, dayStart: start.toISOString(), dayEnd: end.toISOString() } });
    },
    refetchInterval: 20000,
  });

  const sessions = feed.data?.sessions ?? [];

  // Auto: session i becomes active N minutes (set by the booth) after session i-1 starts.
  // A manual pick by the operator stays until the next automatic switch.
  const autoId =
    sessions.length === 0
      ? ""
      : date === todayStr()
        ? sessions[autoSessionIndex(sessions.map((s) => s.startsAt), now, feed.data?.switchMinutes ?? 60)]!.id
        : sessions[0]!.id;
  const sessionId =
    manualPick && manualPick.autoId === autoId && sessions.some((s) => s.id === manualPick.id) ? manualPick.id : autoId;
  const setSessionId = (id: string) => setManualPick(id ? { id, autoId } : null);

  const submit = useMutation({
    mutationFn: (code: string) =>
      scanEntry({
        data: { ...auth, code, sessionId: sessionId || null },
      }),
    onSuccess: (res) => {
      setResult(res);
      if (res.result === "ok") {
        void navigator.vibrate?.(80);
        void qc.invalidateQueries({ queryKey: ["entry-feed", deviceId] });
      }
    },
    onError: () => toast.error("ثبت ورود ناموفق بود. دوباره تلاش کنید."),
  });

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      if (lastRef.current.code === code && now - lastRef.current.at < 2500) return;
      lastRef.current = { code, at: now };
      submit.mutate(code);
    },
    [submit],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCameraError("");

    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || typeof md.getUserMedia !== "function") {
      setCameraError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "دوربین فقط روی نشانی امن (HTTPS) کار می‌کند؛ لطفاً نسخهٔ منتشرشدهٔ سامانه را باز کنید."
          : "این مرورگر امکان استفاده از دوربین را پشتیبانی نمی‌کند.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await md.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      setCameraError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "دسترسی به دوربین داده نشده است. از تنظیمات مرورگر (Safari ← تنظیمات سایت ← دوربین) اجازه دوربین را روی «مجاز» بگذارید و دوباره تلاش کنید."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "دوربینی روی این دستگاه پیدا نشد."
            : name === "NotReadableError"
              ? "دوربین در حال استفاده توسط برنامهٔ دیگری است یا در تنظیمات دستگاه مسدود شده است."
              : "باز کردن دوربین ممکن نشد. دوباره تلاش کنید یا کد بلیت را دستی وارد کنید.",
      );
      return;
    }

    streamRef.current = stream;
    setScanning(true);

    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      try {
        await video.play();
      } catch {
        /* autoplay retry happens on next frame */
      }
    }

    const Detector = (
      globalThis as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    const tick = async () => {
      const v = videoRef.current;
      if (!streamRef.current || !v) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        let value: string | undefined;
        if (detector) {
          try {
            value = (await detector.detect(v))[0]?.rawValue;
          } catch {
            /* transient decode failure */
          }
        }
        if (!value) {
          const canvas = (canvasRef.current ??= document.createElement("canvas"));
          const w = Math.min(v.videoWidth, 640);
          const h = Math.round((v.videoHeight / v.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            value = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data;
          }
        }
        if (value) handleCode(value);
      }
      if (streamRef.current) window.setTimeout(() => void tick(), 200);
    };
    void tick();
  };



  const active = sessions.find((s) => s.id === sessionId) ?? null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-16">
      <div className="panel flex items-center justify-between p-4">
        <div>
          <h1 className="gold-text flex items-center gap-2 text-lg font-bold"><PanelIcon panel="entry" />کنترل ورود</h1>
          <p className="mt-1 text-xs text-muted-foreground">اپراتور: {operatorName}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">ورود امروز</p>
          <p className="text-xl font-bold text-primary">{toFa(feed.data?.todayCount ?? 0)}</p>
        </div>
      </div>

      <div className="panel space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">سانس فعال کنترل ورود</p>
            {active ? (
              <p className="mt-1 font-bold">
                {active.title} • {active.hallName} • {formatJalaliDate(active.startsAt)} ساعت{" "}
                {formatTime(active.startsAt)}
              </p>
            ) : (
              <p className="mt-1 font-bold text-destructive">
                {feed.isLoading ? "در حال بارگذاری…" : "برای این تاریخ سانسی وجود ندارد"}
              </p>
            )}
          </div>
          <Button size="sm" variant={manualMode ? "default" : "secondary"} onClick={() => setManualMode((v) => !v)}>
            <Settings2 className="ml-1 size-4" /> {manualMode ? "بستن" : "تغییر تاریخ و سانس"}
          </Button>
        </div>
        {manualMode ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="space-y-1">
              <Label>تاریخ</Label>
              <JalaliDatePicker
                value={date}
                onChange={(v) => {
                  if (!v) return;
                  setDate(v);
                  setSessionId("");
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>سانس</Label>
              <Select value={sessionId} onValueChange={setSessionId} disabled={sessions.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={sessions.length ? "انتخاب سانس" : "سانسی وجود ندارد"} />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} • {s.hallName} • {formatTime(s.startsAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDate(todayStr());
                setSessionId("");
                setManualMode(false);
              }}
            >
              بازگشت به امروز و سانس پیش‌فرض
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          فقط بلیت‌های همین سانس تأیید می‌شوند؛ بلیت سایر تاریخ‌ها و سانس‌ها رد می‌شود.
        </p>
      </div>

      <div className="panel space-y-3 p-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-black/60 aspect-video">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {!scanning ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              دوربین خاموش است
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-primary/70" />
          )}
        </div>
        {cameraError ? <p className="text-xs text-destructive">{cameraError}</p> : null}
        {scanning ? (
          <Button variant="secondary" className="w-full" onClick={stopCamera}>
            <CameraOff className="ml-2 size-4" /> توقف اسکن
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void startCamera()}>
            <Camera className="ml-2 size-4" /> شروع اسکن با دوربین
          </Button>
        )}
      </div>

      <form
        className="panel space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.trim();
          if (code.length < 4) {
            toast.error("کد بلیت را وارد کنید.");
            return;
          }
          lastRef.current = { code: "", at: 0 };
          submit.mutate(code);
          setManual("");
        }}
      >
        <Label htmlFor="code">ورود دستی کد بلیت</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="کد روی بلیت"
            dir="ltr"
            className="text-left"
          />
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </Button>
        </div>
      </form>

      {result ? <ResultCard result={result} /> : null}

      <div className="panel p-4">
        <h2 className="mb-3 text-sm font-bold">آخرین ورودها</h2>
        {feed.isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-primary" />
        ) : (feed.data?.entries.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">هنوز ورودی ثبت نشده است.</p>
        ) : (
          <ul className="space-y-2">
            {feed.data?.entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                <span className="font-medium">
                  {e.showTitle} • ردیف {toFa(e.rowLabel)} صندلی {toFa(e.seatNumber)}
                </span>
                <span className="text-muted-foreground">{formatTime(e.enteredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  if (result.result === "unauthorized")
    return <Banner tone="bad" icon={<XCircle className="size-6" />} title="دسترسی این دستگاه معتبر نیست." />;
  if (result.result === "notfound")
    return <Banner tone="bad" icon={<XCircle className="size-6" />} title="بلیتی با این کد پیدا نشد." />;
  if (result.result === "no_session")
    return <Banner tone="bad" icon={<XCircle className="size-6" />} title="جلسه‌ای برای این بلیت فعال نیست." />;


  const t = result.ticket;
  const details = (
    <div className="mt-3 space-y-1 text-xs leading-6">
      <p className="text-sm font-bold">{t.showTitle}</p>
      <p>
        {t.hallName}
        {t.sectionName ? ` • ${t.sectionName}` : ""} • ردیف {toFa(t.rowLabel)} • صندلی{" "}
        {toFa(t.seatNumber)}
      </p>
      <p className="text-muted-foreground">سانس: {formatJalaliDateTime(t.startsAt)}</p>
      <p className="text-muted-foreground" dir="ltr">
        {t.code}
      </p>
    </div>
  );

  if (result.result === "ok")
    return (
      <Banner tone="good" icon={<CheckCircle2 className="size-6" />} title="ورود ثبت شد">
        {details}
      </Banner>
    );

  if (result.result === "duplicate")
    return (
      <Banner tone="warn" icon={<AlertTriangle className="size-6" />} title="این بلیت قبلاً استفاده شده است">
        {details}
        <p className="mt-2 text-xs">
          ورود پیشین: {formatJalaliDateTime(result.enteredAt)} توسط {result.operatorName}
        </p>
      </Banner>
    );

  if (result.result === "wrong_session")
    return (
      <Banner tone="warn" icon={<TicketIcon className="size-6" />} title="این بلیت برای سانس انتخاب‌شده نیست">
        {details}
      </Banner>
    );

  return (
    <Banner tone="bad" icon={<XCircle className="size-6" />} title="این بلیت باطل شده است">
      {details}
    </Banner>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "good" | "warn" | "bad";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  const tones = {
    good: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    bad: "border-destructive/50 bg-destructive/10 text-destructive",
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
