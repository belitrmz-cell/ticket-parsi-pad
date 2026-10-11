import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  JALALI_MONTHS,
  WEEK_DAYS,
  WEEK_DAYS_SHORT,
  isJalaliLeap,
  jalaliToDateStr,
  toFa,
  toJalali,
  todayJalali,
} from "@/lib/persian";

function monthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/** Weekday index (0 = شنبه) of the 1st day of a Jalali month */
function firstWeekday(jy: number, jm: number) {
  const iso = jalaliToDateStr(jy, jm, 1);
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 1) % 7;
}

/** value/onChange use gregorian "YYYY-MM-DD" strings; the UI is fully Jalali. */
export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  clearable = false,
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const today = todayJalali();
  const selected = useMemo(() => {
    if (!value) return null;
    const [y = 0, m = 1, d = 1] = value.split("-").map(Number);
    const [jy, jm, jd] = toJalali(y, m, d);
    return { jy, jm, jd };
  }, [value]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState({
    jy: selected?.jy ?? today.jy,
    jm: selected?.jm ?? today.jm,
  });

  const len = monthLength(view.jy, view.jm);
  const offset = firstWeekday(view.jy, view.jm);

  const shift = (delta: number) => {
    let jm = view.jm + delta;
    let jy = view.jy;
    if (jm > 12) {
      jm = 1;
      jy += 1;
    }
    if (jm < 1) {
      jm = 12;
      jy -= 1;
    }
    setView({ jy, jm });
  };

  const weekday = value
    ? WEEK_DAYS[(new Date(...((([y = 0, m = 1, d = 1]) => [y, m - 1, d] as const)(value.split("-").map(Number)))).getDay() + 1) % 7]
    : "";
  const label = selected
    ? `${weekday} ${toFa(selected.jd)} ${JALALI_MONTHS[selected.jm - 1]} ${toFa(selected.jy)}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span>{label}</span>
          <span className="flex items-center gap-1">
            {clearable && selected ? (
              <X
                className="size-4 text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            ) : null}
            <CalendarDays className="size-4 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button type="button" size="icon" variant="ghost" onClick={() => shift(-1)}>
            <ChevronRight className="size-4" />
          </Button>
          <p className="text-sm font-semibold">
            {JALALI_MONTHS[view.jm - 1]} {toFa(view.jy)}
          </p>
          <Button type="button" size="icon" variant="ghost" onClick={() => shift(1)}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {WEEK_DAYS_SHORT.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: len }).map((_, i) => {
            const day = i + 1;
            const isSel =
              selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day;
            const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onChange(jalaliToDateStr(view.jy, view.jm, day));
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md py-1.5 text-sm transition-colors hover:bg-secondary",
                  isSel && "bg-primary font-bold text-primary-foreground hover:bg-primary",
                  !isSel && isToday && "border border-primary",
                )}
              >
                {toFa(day)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
