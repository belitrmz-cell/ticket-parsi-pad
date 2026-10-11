import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Minus, MousePointer2, Plus, Save, Trash2 } from "lucide-react";
import {
  loadLayout,
  makeSeats,
  renumberRows,
  saveLayout,
  OBJECT_COLORS,
  OBJECT_LABELS,
  SEAT_GAP,
  SEAT_SIZE,
  type Layout,
  type ObjectT,
  type RowT,
  type SeatT,
} from "@/lib/hall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toFa, faToEn } from "@/lib/persian";

type Sel = { kind: "row" | "object" | "seat"; id: string } | null;

const empty: Layout = { sections: [], rows: [], seats: [], objects: [] };

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function HallBuilder({ hallId, hallName }: { hallId: string; hallName: string }) {
  const [layout, setLayout] = useState<Layout>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [seatMode, setSeatMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [defaultSeats, setDefaultSeats] = useState(8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [picked, setPicked] = useState<string[]>([]);
  const asideRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ kind: string; id: string; dx: number; dy: number; moved: boolean } | null>(
    null,
  );
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    void (async () => {
      setLayout(await loadLayout(hallId));
      setLoading(false);
    })();
  }, [hallId]);

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: (e.clientX - box.left - pan.x) / zoom,
      y: (e.clientY - box.top - pan.y) / zoom,
    };
  };

  const startDrag =
    (kind: "row" | "object" | "seat", id: string, x: number, y: number) =>
    (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const p = toWorld(e);
      dragRef.current = { kind, id, dx: p.x - x, dy: p.y - y, moved: false };
      setSel({ kind, id });
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      setPan({
        x: panRef.current.x + (e.clientX - panRef.current.px),
        y: panRef.current.y + (e.clientY - panRef.current.py),
      });
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    d.moved = true;
    const p = toWorld(e);
    const nx = Math.round(p.x - d.dx);
    const ny = Math.round(p.y - d.dy);
    setLayout((l) => {
      if (d.kind === "object")
        return {
          ...l,
          objects: l.objects.map((o) => (o.id === d.id ? { ...o, x: nx, y: ny } : o)),
        };
      if (d.kind === "seat")
        return { ...l, seats: l.seats.map((s) => (s.id === d.id ? { ...s, x: nx, y: ny } : s)) };
      if (d.kind === "row") {
        const row = l.rows.find((r) => r.id === d.id);
        if (!row) return l;
        const ddx = nx - row.x;
        const ddy = ny - row.y;
        return {
          ...l,
          rows: l.rows.map((r) => (r.id === d.id ? { ...r, x: nx, y: ny } : r)),
          seats: l.seats.map((s) => (s.row_id === d.id ? { ...s, x: s.x + ddx, y: s.y + ddy } : s)),
        };
      }
      return l;
    });
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (d && d.kind === "seat" && !d.moved) {
      setPicked((p) => (p.includes(d.id) ? p.filter((x) => x !== d.id) : [...p, d.id]));
    } else if (d && d.kind !== "seat") {
      setPicked([]);
    }
    dragRef.current = null;
    panRef.current = null;
  };

  const nextRowLabel = (count: number) =>
    count < ROW_LABELS.length
      ? (ROW_LABELS[count] ?? String(count + 1))
      : String(count + 1);

  const [rowForm, setRowForm] = useState<{ label: string; count: string; price: string } | null>(null);

  const openRowForm = () =>
    setRowForm({ label: nextRowLabel(layout.rows.length), count: String(defaultSeats), price: "" });

  const submitRowForm = () => {
    if (!rowForm) return;
    const label = rowForm.label.trim();
    const raw = faToEn(rowForm.count).trim();
    if (!label) return void toast.error("نام ردیف را وارد کنید.");
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) < 1)
      return void toast.error("تعداد صندلی باید عدد صحیح مثبت باشد.");
    const n = parseInt(raw, 10);
    if (n > 80) return void toast.error("حداکثر ۸۰ صندلی در هر ردیف مجاز است.");
    if (layout.rows.some((r) => r.label === label))
      return void toast.error("ردیفی با این نام وجود دارد.");
    const rawPrice = faToEn(rowForm.price.replace(/[,،٬]/g, "")).trim();
    if (rawPrice && !/^\d+$/.test(rawPrice)) return void toast.error("مبلغ بلیت ردیف معتبر نیست.");
    addRow(label, n, rawPrice ? parseInt(rawPrice, 10) : null);
    setDefaultSeats(n);
    setRowForm(null);
  };

  const resizeRow = (rowId: string, count: number) =>
    setLayout((l) => {
      const row = l.rows.find((r) => r.id === rowId);
      if (!row) return l;
      const mine = renumberRows(l.seats.filter((s) => s.row_id === rowId)).sort(
        (a, b) => a.number - b.number,
      );
      const others = l.seats.filter((s) => s.row_id !== rowId);
      if (count <= mine.length) return { ...l, seats: [...others, ...mine.slice(0, count)] };
      const last = mine[mine.length - 1];
      const extra: SeatT[] = [];
      for (let i = mine.length; i < count; i++) {
        const k = i - mine.length + 1;
        extra.push({
          id: crypto.randomUUID(),
          hall_id: hallId,
          row_id: rowId,
          section_id: row.section_id,
          number: i + 1,
          x: last ? last.x + k * SEAT_GAP : row.x + i * SEAT_GAP,
          y: last ? last.y : row.y,
          is_active: true,
        });
      }
      return { ...l, seats: [...others, ...mine, ...extra] };
    });

  const addRow = (label: string, seatCount: number, price: number | null) => {
    const count = layout.rows.length;
    const row: RowT = {
      id: crypto.randomUUID(),
      hall_id: hallId,
      section_id: null,
      label,
      order_index: count,
      x: 80,
      y: 170 + count * (SEAT_GAP + 12),
      is_active: true,
      price,
    };
    const seats = makeSeats(row, seatCount, []);
    setLayout((l) => ({ ...l, rows: [...l.rows, row], seats: [...l.seats, ...seats] }));
    setSel({ kind: "row", id: row.id });
    setSeatMode(false);
  };

  const activeRowId = useMemo(() => {
    if (sel?.kind === "row") return sel.id;
    if (sel?.kind === "seat") return layout.seats.find((s) => s.id === sel.id)?.row_id ?? null;
    return layout.rows[layout.rows.length - 1]?.id ?? null;
  }, [sel, layout.rows, layout.seats]);

  const addSeatAt = (rowId: string, x: number, y: number) => {
    setLayout((l) => {
      const mine = l.seats.filter((s) => s.row_id === rowId);
      const row = l.rows.find((r) => r.id === rowId);
      if (!row) return l;
      const number = mine.reduce((m, s) => Math.max(m, s.number), 0) + 1;
      const seat: SeatT = {
        id: crypto.randomUUID(),
        hall_id: hallId,
        row_id: rowId,
        section_id: row.section_id,
        number,
        x: Math.round(x),
        y: Math.round(y),
        is_active: true,
      };
      return { ...l, seats: [...l.seats, seat] };
    });
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (seatMode) {
      if (!activeRowId) {
        toast.error("ابتدا یک ردیف بسازید یا انتخاب کنید.");
        return;
      }
      const p = toWorld(e);
      addSeatAt(activeRowId, p.x, p.y);
      return;
    }
    panRef.current = { x: pan.x, y: pan.y, px: e.clientX, py: e.clientY };
    setSel(null);
    setPicked([]);
  };

  const addObject = (kind: string) => {
    const isStage = kind === "stage";
    const isAisle = kind === "aisle";
    const o: ObjectT = {
      id: crypto.randomUUID(),
      hall_id: hallId,
      kind,
      label: OBJECT_LABELS[kind] ?? kind,
      x: 80,
      y: isStage ? 40 : 120,
      width: isStage ? 380 : isAisle ? 40 : 110,
      height: isStage ? 70 : isAisle ? 260 : 46,
      is_active: true,
    };
    setLayout((l) => ({ ...l, objects: [...l.objects, o] }));
    setSel({ kind: "object", id: o.id });
    setSeatMode(false);
  };

  const removeSelected = () => {
    if (!sel && !picked.length) return;
    if (picked.length) {
      if (!window.confirm(`حذف ${toFa(picked.length)} صندلی انتخاب‌شده؟ فضای خالی به‌عنوان راهرو حفظ می‌شود.`)) return;
      const ids = new Set(picked);
      setLayout((l) => ({ ...l, seats: renumberRows(l.seats.filter((s) => !ids.has(s.id))) }));
      setPicked([]);
      setSel(null);
      return;
    }
    if (!sel) return;
    if (!window.confirm("آیا از حذف این مورد مطمئن هستید؟")) return;
    setLayout((l) => {
      if (sel.kind === "object") return { ...l, objects: l.objects.filter((o) => o.id !== sel.id) };
      if (sel.kind === "seat")
        return { ...l, seats: renumberRows(l.seats.filter((s) => s.id !== sel.id)) };
      if (sel.kind === "row")
        return {
          ...l,
          rows: l.rows.filter((r) => r.id !== sel.id),
          seats: l.seats.filter((s) => s.row_id !== sel.id),
        };
      return l;
    });
    setSel(null);
  };

  const aisleOverlap = useMemo(() => {
    const aisles = layout.objects.filter((o) => o.kind === "aisle");
    return layout.seats.some((s) =>
      aisles.some(
        (a) => s.x > a.x && s.x < a.x + a.width && s.y > a.y && s.y < a.y + a.height,
      ),
    );
  }, [layout.objects, layout.seats]);

  const save = async () => {
    setSaving(true);
    try {
      await saveLayout(hallId, layout);
      toast.success("نقشه سالن ذخیره شد.");
      if (aisleOverlap) toast.warning("برخی صندلی‌ها داخل راهرو قرار دارند.");
      setLayout(await loadLayout(hallId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ذخیره ناموفق بود.");
    }
    setSaving(false);
  };

  const seatCount = layout.seats.filter((s) => s.is_active).length;
  const selectedRow = sel?.kind === "row" ? layout.rows.find((r) => r.id === sel.id) : undefined;
  const selectedObject =
    sel?.kind === "object" ? layout.objects.find((o) => o.id === sel.id) : undefined;
  const selectedSeat = sel?.kind === "seat" ? layout.seats.find((s) => s.id === sel.id) : undefined;

  const rowSeats = useMemo(() => {
    const m = new Map<string, SeatT[]>();
    layout.seats.forEach((s) => m.set(s.row_id, [...(m.get(s.row_id) ?? []), s]));
    return m;
  }, [layout.seats]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex flex-col gap-3 lg:flex-row">
      <div className="flex-1">
        <div className="panel mb-3 flex flex-wrap items-center gap-2 p-3">
          <Button size="sm" onClick={openRowForm}>
            + ردیف
          </Button>
          <Button
            size="sm"
            variant={seatMode ? "default" : "secondary"}
            onClick={() => setSeatMode((v) => !v)}
          >
            {seatMode ? <MousePointer2 className="ml-1 size-4" /> : null}
            {seatMode ? "در حال افزودن صندلی" : "+ صندلی"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => addObject("stage")}>
            + سن
          </Button>
          <Button size="sm" variant="secondary" onClick={() => addObject("entry")}>
            + ورودی
          </Button>
          <Button size="sm" variant="secondary" onClick={() => addObject("exit")}>
            + خروجی
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => asideRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            ویژگی‌ها
          </Button>
          {picked.length ? (
            <Button size="sm" variant="destructive" onClick={removeSelected} className="gap-1">
              <Trash2 className="size-4" /> حذف {toFa(picked.length)} صندلی
            </Button>
          ) : null}
          <div className="mr-auto flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>
              <Minus className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{toFa(Math.round(zoom * 100))}٪</span>
            <Button size="icon" variant="ghost" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
              <Plus className="size-4" />
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              ذخیره
            </Button>
          </div>
        </div>

        {rowForm ? (
          <form
            className="panel mb-3 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              submitRowForm();
            }}
          >
            <div className="space-y-1.5">
              <Label>نام یا شماره ردیف</Label>
              <Input
                autoFocus
                maxLength={20}
                value={rowForm.label}
                onChange={(e) => setRowForm({ ...rowForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>تعداد صندلی</Label>
              <Input
                inputMode="numeric"
                maxLength={3}
                value={rowForm.count}
                onChange={(e) => setRowForm({ ...rowForm, count: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>مبلغ بلیت این ردیف (تومان)</Label>
              <Input
                inputMode="numeric"
                placeholder="خالی = قیمت نمایش"
                value={rowForm.price}
                onChange={(e) => setRowForm({ ...rowForm, price: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm">ایجاد ردیف</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRowForm(null)}>
                انصراف
              </Button>
            </div>
          </form>
        ) : null}

        <div className="panel overflow-hidden p-0" style={{ touchAction: "none" }}>
          <svg
            ref={svgRef}
            className="h-[62vh] w-full bg-muted/20"
            style={{ cursor: seatMode ? "crosshair" : "default" }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {layout.objects.map((o) => (
                <g key={o.id} onPointerDown={startDrag("object", o.id, o.x, o.y)}>
                  <rect
                    x={o.x}
                    y={o.y}
                    width={o.width}
                    height={o.height}
                    rx={o.kind === "aisle" ? 6 : 10}
                    fill={OBJECT_COLORS[o.kind] ?? OBJECT_COLORS["other"]}
                    fillOpacity={o.kind === "aisle" ? 0.18 : 0.25}
                    stroke={OBJECT_COLORS[o.kind] ?? OBJECT_COLORS["other"]}
                    strokeDasharray={o.kind === "aisle" ? "6 4" : undefined}
                    strokeWidth={sel?.id === o.id ? 3 : 1.5}
                    style={{ cursor: "move" }}
                  />
                  <text
                    x={o.x + o.width / 2}
                    y={o.y + o.height / 2 + 5}
                    fontSize={13}
                    textAnchor="middle"
                    fill="currentColor"
                    pointerEvents="none"
                  >
                    {o.label}
                  </text>
                </g>
              ))}

              {layout.rows.map((r) => (
                <g key={r.id}>
                  <text
                    x={r.x - 22}
                    y={r.y + 5}
                    fontSize={13}
                    fontWeight={sel?.id === r.id ? 700 : 400}
                    fill="currentColor"
                    onPointerDown={startDrag("row", r.id, r.x, r.y)}
                    style={{ cursor: "move" }}
                  >
                    {r.label}
                  </text>
                  {(rowSeats.get(r.id) ?? []).map((seat) => (
                    <g key={seat.id}>
                      <rect
                        x={seat.x - SEAT_SIZE / 2}
                        y={seat.y - SEAT_SIZE / 2}
                        width={SEAT_SIZE}
                        height={SEAT_SIZE}
                        rx={5}
                        fill={seat.is_active ? "oklch(0.72 0.15 85)" : "oklch(0.4 0 0)"}
                        fillOpacity={seat.is_active ? 0.85 : 0.4}
                        stroke={picked.includes(seat.id) ? "oklch(0.62 0.2 25)" : sel?.id === seat.id ? "currentColor" : "none"}
                        strokeWidth={2}
                        style={{ cursor: "move" }}
                        onPointerDown={startDrag("seat", seat.id, seat.x, seat.y)}
                      />
                      <text
                        x={seat.x}
                        y={seat.y + 3.5}
                        fontSize={9}
                        fontWeight={700}
                        textAnchor="middle"
                        fill={seat.is_active ? "oklch(0.15 0.02 85)" : "currentColor"}
                        fillOpacity={seat.is_active ? 1 : 0.75}
                        pointerEvents="none"
                      >
                        {toFa(seat.number)}
                      </text>
                    </g>
                  ))}
                </g>
              ))}
            </g>
          </svg>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          سالن «{hallName}» — {toFa(seatCount)} صندلی فعال.{" "}
          {seatMode
            ? "روی نقشه بزنید تا صندلی به ردیف انتخاب‌شده اضافه شود."
            : "برای جابه‌جایی، اجزا را بکشید؛ برای جابه‌جایی نقشه، فضای خالی را بکشید."}
        </p>
        {aisleOverlap ? (
          <p className="mt-1 text-xs text-destructive">
            هشدار: برخی صندلی‌ها با راهرو تداخل دارند.
          </p>
        ) : null}
      </div>

      <aside ref={asideRef} className="panel w-full space-y-4 p-4 lg:w-80">
        <p className="font-semibold">ویژگی‌ها</p>
        {picked.length ? (
          <p className="text-sm">
            {toFa(picked.length)} صندلی انتخاب شده. برای ساخت راهرو آن‌ها را حذف کنید؛ شماره‌ها خودکار مرتب می‌شوند.
          </p>
        ) : null}
        {!sel && !picked.length ? (
          <p className="text-sm text-muted-foreground">یک جزء را انتخاب کنید.</p>
        ) : null}

        {selectedRow ? (
          <div className="space-y-3">
            <Field
              label="نام یا شماره ردیف"
              value={selectedRow.label}
              onChange={(v) =>
                setLayout((l) => ({
                  ...l,
                  rows: l.rows.map((r) => (r.id === selectedRow.id ? { ...r, label: v } : r)),
                }))
              }
            />
            <NumField
              key={selectedRow.id}
              label="تعداد صندلی‌ها"
              min={1}
              max={80}
              value={(rowSeats.get(selectedRow.id) ?? []).length}
              onChange={(v) => resizeRow(selectedRow.id, v)}
            />
            <div className="space-y-1.5">
              <Label>مبلغ بلیت این ردیف (تومان)</Label>
              <Input
                inputMode="numeric"
                placeholder="خالی = قیمت نمایش"
                value={selectedRow.price == null ? "" : String(selectedRow.price)}
                onChange={(e) => {
                  const raw = faToEn(e.target.value.replace(/[,،٬]/g, "")).trim();
                  if (raw && !/^\d+$/.test(raw)) return;
                  const price = raw ? parseInt(raw, 10) : null;
                  setLayout((l) => ({
                    ...l,
                    rows: l.rows.map((r) => (r.id === selectedRow.id ? { ...r, price } : r)),
                  }));
                }}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => {
                const mine = (rowSeats.get(selectedRow.id) ?? []).slice().sort((a, b) => a.x - b.x);
                const last = mine[mine.length - 1];
                addSeatAt(
                  selectedRow.id,
                  last ? last.x + SEAT_GAP : selectedRow.x,
                  last ? last.y : selectedRow.y,
                );
              }}
            >
              افزودن یک صندلی به این ردیف
            </Button>
            <p className="text-xs text-muted-foreground">
              فاصله پیش‌فرض صندلی‌ها {toFa(SEAT_GAP)} پیکسل است.
            </p>
          </div>
        ) : null}

        {selectedObject ? (
          <div className="space-y-3">
            <Field
              label="برچسب"
              value={selectedObject.label}
              onChange={(v) =>
                setLayout((l) => ({
                  ...l,
                  objects: l.objects.map((o) => (o.id === selectedObject.id ? { ...o, label: v } : o)),
                }))
              }
            />
            <NumField
              label="عرض"
              value={selectedObject.width}
              onChange={(v) =>
                setLayout((l) => ({
                  ...l,
                  objects: l.objects.map((o) =>
                    o.id === selectedObject.id ? { ...o, width: Math.max(10, v) } : o,
                  ),
                }))
              }
            />
            <NumField
              label="طول"
              value={selectedObject.height}
              onChange={(v) =>
                setLayout((l) => ({
                  ...l,
                  objects: l.objects.map((o) =>
                    o.id === selectedObject.id ? { ...o, height: Math.max(10, v) } : o,
                  ),
                }))
              }
            />
          </div>
        ) : null}

        {selectedSeat ? (
          <div className="space-y-3">
            <NumField
              label="شماره صندلی"
              value={selectedSeat.number}
              onChange={(v) =>
                setLayout((l) => {
                  const dup = l.seats.some(
                    (s) =>
                      s.row_id === selectedSeat.row_id && s.id !== selectedSeat.id && s.number === v,
                  );
                  if (dup) {
                    toast.error("این شماره در همین ردیف تکراری است.");
                    return l;
                  }
                  return {
                    ...l,
                    seats: l.seats.map((s) => (s.id === selectedSeat.id ? { ...s, number: v } : s)),
                  };
                })
              }
            />
            <div className="space-y-1.5">
              <Label>ردیف</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedSeat.row_id}
                onChange={(e) =>
                  setLayout((l) => ({
                    ...l,
                    seats: l.seats.map((s) =>
                      s.id === selectedSeat.id ? { ...s, row_id: e.target.value } : s,
                    ),
                  }))
                }
              >
                {layout.rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() =>
                setLayout((l) => ({
                  ...l,
                  seats: l.seats.map((s) =>
                    s.id === selectedSeat.id ? { ...s, is_active: !s.is_active } : s,
                  ),
                }))
              }
            >
              {selectedSeat.is_active ? "غیرفعال کردن صندلی" : "فعال کردن صندلی"}
            </Button>
          </div>
        ) : null}

        {sel || picked.length ? (
          <Button variant="destructive" size="sm" className="w-full gap-2" onClick={removeSelected}>
            <Trash2 className="size-4" /> حذف
          </Button>
        ) : null}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(toFa(value));
  useEffect(() => setText(toFa(value)), [value]);
  const commit = () => {
    const raw = faToEn(text).trim();
    if (!/^\d+$/.test(raw)) {
      toast.error("یک عدد صحیح وارد کنید.");
      setText(toFa(value));
      return;
    }
    const n = parseInt(raw, 10);
    if (n < min || n > max) {
      toast.error(`عدد باید بین ${toFa(min)} و ${toFa(max)} باشد.`);
      setText(toFa(value));
      return;
    }
    if (n !== value) onChange(n);
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
