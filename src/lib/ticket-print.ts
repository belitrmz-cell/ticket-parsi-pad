import QRCode from "qrcode";
import type { SoldTicket } from "@/lib/booth.functions";
import { formatJalaliDate, formatTime, money, toFa } from "@/lib/persian";

export type PrintSize = "standard" | "narrow" | "small";

export const PRINT_SIZE_LABELS: Record<PrintSize, string> = {
  standard: "استاندارد",
  narrow: "باریک (چند بلیت روی A4)",
  small: "کوچک (پرینتر حرارتی)",
};

const CSS: Record<PrintSize, string> = {
  standard: `@page{size:A5 landscape;margin:8mm}
    .t{width:100%;min-height:120mm;page-break-after:always;padding:8mm;gap:8mm}
    .qr{width:45mm;height:45mm} h1{font-size:22px} .row{font-size:14px} .seat{font-size:26px}`,
  narrow: `@page{size:A4 portrait;margin:8mm}
    body{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
    .t{break-inside:avoid;padding:4mm;gap:4mm;min-height:60mm}
    .qr{width:28mm;height:28mm} h1{font-size:15px} .row{font-size:11px} .seat{font-size:18px}`,
  small: `@page{size:80mm auto;margin:3mm}
    .t{width:72mm;flex-direction:column;align-items:center;text-align:center;padding:2mm;gap:2mm;page-break-after:always}
    .qr{width:40mm;height:40mm} h1{font-size:14px} .row{font-size:11px} .seat{font-size:18px}`,
};

export async function printTickets(
  tickets: SoldTicket[],
  size: PrintSize,
  meta: { saleSerial: number; operatorName: string },
) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("popup");
  const items = await Promise.all(
    tickets.map(async (t) => {
      const qr = await QRCode.toDataURL(t.qrToken, { margin: 1, width: 300, errorCorrectionLevel: "M" });
      return `<div class="t">
        <div class="info">
          <h1>${esc(t.showTitle)}</h1>
          <div class="row">${toFa(formatJalaliDate(t.startsAt))} — ساعت ${formatTime(t.startsAt)}</div>
          <div class="row">سالن: ${esc(t.hallName)}</div>
          <div class="seat">ردیف ${esc(t.rowLabel)} • صندلی ${toFa(t.seatNumber)}</div>
          <div class="row">مبلغ: ${money(t.price)} • پرداخت در باجه</div>
          <div class="row">کد بلیت: <b dir="ltr">${esc(t.code.toUpperCase())}</b> • سریال ${toFa(t.serial)}</div>
          <div class="row muted">فروش ${toFa(meta.saleSerial)} • اپراتور: ${esc(meta.operatorName)}</div>
        </div>
        <img class="qr" src="${qr}" alt="QR" />
      </div>`;
    }),
  );
  w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>چاپ بلیت</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap">
    <style>*{box-sizing:border-box}body{font-family:Vazirmatn,Tahoma,sans-serif;margin:0;color:#000}
    .t{display:flex;justify-content:space-between;align-items:center;border:1.5px dashed #000;border-radius:6px}
    .info{display:flex;flex-direction:column;gap:2mm} h1{margin:0} .seat{font-weight:700} .muted{color:#444}
    ${CSS[size]}</style></head><body>${items.join("")}
    <script>window.onload=()=>{setTimeout(()=>{window.print()},300)}</script></body></html>`);
  w.document.close();
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
