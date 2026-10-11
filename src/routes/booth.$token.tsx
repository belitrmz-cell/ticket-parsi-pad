import { PanelIcon } from "@/components/PanelIcon";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, ShoppingCart, Ticket, ScanLine, Undo2 } from "lucide-react";
import { BoothRefundedTickets } from "@/components/BoothRefundedTickets";
import { OperatorGate } from "@/components/OperatorGate";
import { BoothSeatMap } from "@/components/BoothSeatMap";
import { BoothTicketList } from "@/components/BoothTicketList";
import { BoothTicketCheck } from "@/components/BoothTicketCheck";
import { useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/device";
import { panelPwaHead } from "@/lib/pwa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/booth/$token")({
  head: () => {
    const pwa = panelPwaHead("booth");
    return {
      meta: [
        { title: "باجه فروش بلیت | سامانه بلیت" },
        { name: "description", content: "ورود اپراتور باجه برای فروش حضوری بلیت نمایش." },
        { property: "og:title", content: "باجه فروش بلیت" },
        { property: "og:description", content: "ورود اپراتور باجه برای فروش حضوری بلیت نمایش." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...pwa.meta,
      ],
      links: pwa.links,
    };
  },
  component: BoothPage,
});

type Tab = "sell" | "list" | "check" | "refunds";
const ITEMS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "sell", label: "فروش بلیت", icon: <ShoppingCart className="size-4" /> },
  { id: "list", label: "بلیت‌ها", icon: <Ticket className="size-4" /> },
  { id: "check", label: "استعلام و استرداد", icon: <ScanLine className="size-4" /> },
  { id: "refunds", label: "بلیت‌های استردادشده", icon: <Undo2 className="size-4" /> },
];

function BoothPage() {
  const { token } = useParams({ from: "/booth/$token" });
  const [deviceId, setDeviceId] = useState("");
  const [tab, setTab] = useState<Tab>("sell");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  useEffect(() => setDeviceId(getDeviceId()), []);
  return (
    <OperatorGate kind="booth" token={token} title="باجه فروش بلیت">
      {({ operatorName, sessionToken }) => {
        const auth = { token, deviceId, sessionToken };
        return (
          <div dir="rtl" className="min-h-dvh">
            <aside className={cn(
              "fixed inset-y-0 right-0 z-40 w-72 border-l border-sidebar-border bg-sidebar p-4 transition-transform",
              open ? "translate-x-0" : "translate-x-full",
            )}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="gold-text text-lg font-bold">باجه فروش بلیت</p>
                  <p className="text-xs text-muted-foreground">اپراتور: {operatorName}</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="بستن منو"><X className="size-5" /></button>
              </div>
              <nav className="flex flex-col gap-1">
                {ITEMS.map((i) => (
                  <button key={i.id} onClick={() => { setTab(i.id); setOpen(false); }}
                    className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-right text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                      tab === i.id && "bg-sidebar-accent font-semibold text-primary")}>
                    {i.icon}<span>{i.label}</span>
                  </button>
                ))}
              </nav>
            </aside>
            {open && <div className="fixed inset-0 z-30 bg-background/70" onClick={() => setOpen(false)} />}
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
              <button onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu className="size-6" /></button>
              <PanelIcon panel="booth" />
              <span className="gold-text font-bold">{ITEMS.find((i) => i.id === tab)?.label}</span>
              <span className="mr-auto text-sm text-muted-foreground">اپراتور: {operatorName}</span>
            </header>
            <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
              {deviceId ? (
                tab === "sell" ? <BoothSeatMap auth={auth} />
                : tab === "list" ? <BoothTicketList auth={auth} />
                : tab === "refunds" ? <BoothRefundedTickets auth={auth} />
                : <BoothTicketCheck auth={auth} onRefunded={() => {
                    void qc.invalidateQueries({ queryKey: ["booth-map"] });
                    void qc.invalidateQueries({ queryKey: ["booth-tickets"] });
                  }} />
              ) : null}
            </main>
          </div>
        );
      }}
    </OperatorGate>
  );
}
