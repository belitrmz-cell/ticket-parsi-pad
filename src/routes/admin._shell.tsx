import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Theater,
  BarChart3,
  Settings,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { panelPwaHead } from "@/lib/pwa";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/admin/_shell")({
  head: () => panelPwaHead("admin"),
  component: AdminShell,
});

const items = [
  { to: "/admin/dashboard", label: "داشبورد", icon: <LayoutDashboard className="size-4" /> },
  { to: "/admin/directors", label: "کارگردان‌ها", icon: <Users className="size-4" /> },
  { to: "/admin/requests", label: "درخواست‌های ثبت‌نام", icon: <UserPlus className="size-4" /> },
  { to: "/admin/shows", label: "نمایش‌ها", icon: <Theater className="size-4" /> },
  { to: "/admin/reports", label: "گزارش‌ها", icon: <BarChart3 className="size-4" /> },
  { to: "/admin/settings", label: "تنظیمات", icon: <Settings className="size-4" /> },
];

function AdminShell() {
  const { loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "admin") navigate({ to: "/admin/login" });
  }, [loading, role, navigate]);

  if (loading || role !== "admin") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell panel="admin" title="پنل مدیر" subtitle="مدیریت سامانه" items={items}>
      <Outlet />
    </AppShell>
  );
}
