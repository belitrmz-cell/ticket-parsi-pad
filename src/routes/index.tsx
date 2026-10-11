import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket, LayoutDashboard, ScanLine } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سامانه مدیریت نمایش و فروش بلیت" },
      {
        name: "description",
        content:
          "سامانه یکپارچه مدیریت نمایش، طراحی سالن، فروش حضوری بلیت در باجه و کنترل ورود تماشاگران.",
      },
      { property: "og:title", content: "سامانه مدیریت نمایش و فروش بلیت" },
      {
        property: "og:description",
        content: "مدیریت نمایش، طراحی سالن، فروش حضوری بلیت و کنترل ورود.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div dir="rtl" className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-xl p-8 text-center">
        <p className="text-4xl">🎭</p>
        <h1 className="gold-text mt-4 text-3xl font-extrabold">سامانه مدیریت نمایش و بلیت</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          مدیریت نمایش‌ها، طراحی نقشه سالن، فروش حضوری بلیت در باجه و کنترل ورود تماشاگران، همگی در
          یک سامانه یکپارچه.
        </p>

        <div className="mt-8 grid gap-3 text-right">
          <div className="flex items-center gap-3 rounded-lg bg-secondary p-3 text-sm">
            <LayoutDashboard className="size-5 text-primary" />
            نقشه سالن یکتا؛ همان نقشه‌ای که طراحی می‌شود، در فروش و ورود استفاده می‌شود.
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-secondary p-3 text-sm">
            <Ticket className="size-5 text-primary" />
            فروش بلیت فقط حضوری در باجه، بدون پرداخت آنلاین.
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-secondary p-3 text-sm">
            <ScanLine className="size-5 text-primary" />
            کنترل ورود با اسکن کد امن بلیت.
          </div>
        </div>

        <Link
          to="/admin/login"
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          ورود مدیر سامانه
        </Link>
        <p className="mt-4 text-xs text-muted-foreground">
          کارگردان‌ها، اپراتور باجه و کنترل ورود از لینک اختصاصی خود وارد می‌شوند.
        </p>
      </div>
    </div>
  );
}
