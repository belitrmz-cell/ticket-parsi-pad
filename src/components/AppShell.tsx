import { PanelIcon } from "@/components/PanelIcon";
import type { PanelKey } from "@/lib/panel-icons.functions";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: ReactNode };

export function AppShell({
  title,
  subtitle,
  panel,
  items,
  children,
}: {
  title: string;
  subtitle?: string;
  panel?: PanelKey;
  items: NavItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div dir="rtl" className="min-h-dvh md:flex">
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-72 border-l border-sidebar-border bg-sidebar p-4 transition-transform md:static md:translate-x-0 print:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {panel ? <PanelIcon panel={panel} className="size-10" /> : null}
            <div>
            <p className="gold-text text-lg font-bold">{title}</p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="بستن منو">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-semibold text-primary" }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="size-4" /> خروج
        </Button>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-background/70 md:hidden print:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="باز کردن منو">
            <Menu className="size-6" />
          </button>
          <span className="gold-text font-bold">{title}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
