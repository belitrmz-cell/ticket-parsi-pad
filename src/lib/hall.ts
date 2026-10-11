import { supabase } from "@/integrations/supabase/client";

export type SectionT = {
  id: string;
  hall_id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  is_active: boolean;
};

export type RowT = {
  id: string;
  hall_id: string;
  section_id: string | null;
  label: string;
  order_index: number;
  x: number;
  y: number;
  is_active: boolean;
  price?: number | null;
};

export type SeatT = {
  id: string;
  hall_id: string;
  row_id: string;
  section_id: string | null;
  number: number;
  x: number;
  y: number;
  is_active: boolean;
};

export type ObjectT = {
  id: string;
  hall_id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_active: boolean;
};

export type Layout = {
  sections: SectionT[];
  rows: RowT[];
  seats: SeatT[];
  objects: ObjectT[];
};

export const SECTION_COLORS: Record<string, string> = {
  a: "oklch(0.72 0.15 85)",
  b: "oklch(0.62 0.16 25)",
  c: "oklch(0.62 0.12 190)",
  d: "oklch(0.6 0.14 300)",
};

export const OBJECT_LABELS: Record<string, string> = {
  stage: "سن",
  entry: "ورودی",
  exit: "خروجی",
  aisle: "راهرو",
  other: "سایر",
};

export const OBJECT_COLORS: Record<string, string> = {
  stage: "oklch(0.62 0.16 25)",
  entry: "oklch(0.65 0.15 145)",
  exit: "oklch(0.65 0.15 60)",
  aisle: "oklch(0.6 0.05 250)",
  other: "oklch(0.6 0.02 250)",
};

export const SEAT_GAP = 30;
export const SEAT_SIZE = 22;

export async function loadLayout(hallId: string): Promise<Layout> {
  const [{ data: sections }, { data: rows }, { data: seats }, { data: objects }] =
    await Promise.all([
      supabase.from("sections").select("*").eq("hall_id", hallId),
      supabase.from("hall_rows").select("*").eq("hall_id", hallId).order("order_index"),
      supabase.from("seats").select("*").eq("hall_id", hallId).gt("number", 0).order("number"),
      supabase.from("hall_objects").select("*").eq("hall_id", hallId),
    ]);
  return {
    sections: (sections ?? []) as SectionT[],
    rows: (rows ?? []) as RowT[],
    seats: (seats ?? []) as SeatT[],
    objects: (objects ?? []) as ObjectT[],
  };
}

async function syncTable(
  table: "sections" | "hall_rows" | "seats" | "hall_objects",
  hallId: string,
  rowsToKeep: Record<string, unknown>[],
) {
  let q = supabase.from(table).select("id").eq("hall_id", hallId);
  if (table === "seats") q = q.gt("number", 0);
  const { data: existing } = await q;
  const keep = new Set(rowsToKeep.map((r) => r["id"] as string));
  const remove = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (table === "seats" && remove.length) {
    // seats: hard delete when unused; soft-delete (inactive, hidden) when tickets reference them
    for (const id of remove) {
      const { error } = await supabase.from("seats").delete().eq("id", id);
      if (error) {
        const { error: e2 } = await supabase
          .from("seats")
          .update({ is_active: false, number: -Math.floor(Date.now() / 1000 + Math.random() * 1e6) })
          .eq("id", id);
        if (e2) throw new Error(e2.message);
      }
    }
    remove.length = 0;
  }
  if (rowsToKeep.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table).upsert(rowsToKeep as any);
    if (error) throw new Error(error.message);
  }
  if (remove.length) {
    const { error } = await supabase.from(table).delete().in("id", remove);
    if (error) throw new Error("حذف بخشی از موارد ممکن نشد؛ احتمالاً بلیت فروخته شده دارند.");
  }
}

export async function saveLayout(hallId: string, layout: Layout) {
  await syncTable("sections", hallId, layout.sections);
  await syncTable("hall_rows", hallId, layout.rows);
  await syncTable("seats", hallId, layout.seats);
  await syncTable("hall_objects", hallId, layout.objects);
}

export function makeSeats(row: RowT, count: number, existing: SeatT[]): SeatT[] {
  const mine = existing.filter((s) => s.row_id === row.id).sort((a, b) => a.number - b.number);
  const result: SeatT[] = [];
  for (let i = 0; i < count; i++) {
    const prev = mine[i];
    result.push({
      id: prev?.id ?? crypto.randomUUID(),
      hall_id: row.hall_id,
      row_id: row.id,
      section_id: row.section_id,
      number: i + 1,
      x: row.x + i * SEAT_GAP,
      y: row.y,
      is_active: prev?.is_active ?? true,
    });
  }
  return result;
}

/** Renumber seats 1..n per row by physical order (x, then y). Positions are untouched. */
export function renumberRows(seats: SeatT[]): SeatT[] {
  const byRow = new Map<string, SeatT[]>();
  seats.forEach((s) => byRow.set(s.row_id, [...(byRow.get(s.row_id) ?? []), s]));
  const num = new Map<string, number>();
  byRow.forEach((list) =>
    list
      .slice()
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .forEach((s, i) => num.set(s.id, i + 1)),
  );
  return seats.map((s) => ({ ...s, number: num.get(s.id) ?? s.number }));
}
