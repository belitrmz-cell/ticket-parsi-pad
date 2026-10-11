import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Theater,
  Ticket,
  Users,
  BarChart3,
  Settings,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/director/_shell")({
  component: DirectorShell,
});

const items = [
  { to: "/director/dashboard", label: "داشبورد", icon: <LayoutDashboard className="size-4" /> },
  { to: "/director/halls", label: "سالن‌های من", icon: <Building2 className="size-4" /> },
  { to: "/director/shows", label: "نمایش‌ها", icon: <Theater className="size-4" /> },
  { to: "/director/sessions", label: "سانس‌های نمایش", icon: <CalendarClock className="size-4" /> },
  { to: "/director/tickets", label: "بلیت‌ها", icon: <Ticket className="size-4" /> },
  { to: "/director/operators", label: "اپراتورها", icon: <Users className="size-4" /> },
  { to: "/director/reports", label: "گزارش‌ها", icon: <BarChart3 className="size-4" /> },
  { to: "/director/settings", label: "تنظیمات", icon: <Settings className="size-4" /> },
];

function DirectorShell() {
  const { loading, role, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "director") navigate({ to: "/" });
  }, [loading, role, navigate]);

  if (loading || role !== "director") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell panel="director" title="پنل کارگردان" subtitle={profile?.full_name ?? ""} items={items}>
      <Outlet />
    </AppShell>
  );
}
