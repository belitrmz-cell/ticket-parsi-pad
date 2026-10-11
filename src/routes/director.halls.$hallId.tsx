import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HallBuilder } from "@/components/HallBuilder";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/director/halls/$hallId")({
  head: () => ({
    meta: [
      { title: "طراحی سالن | پنل کارگردان" },
      { name: "description", content: "طراحی نقشه سالن: جایگاه، ردیف، صندلی، سن و درها." },
      { property: "og:title", content: "طراحی سالن" },
      { property: "og:description", content: "ساخت نقشه واقعی سالن برای فروش بلیت." },
    ],
  }),
  component: HallEditor,
});

function HallEditor() {
  const { hallId } = useParams({ from: "/director/halls/$hallId" });
  const { data, isLoading } = useQuery({
    queryKey: ["hall", hallId],
    queryFn: async () => {
      const { data: hall } = await supabase.from("halls").select("*").eq("id", hallId).maybeSingle();
      return hall;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center">
        <p className="panel p-6">سالن پیدا نشد.</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">طراحی سالن {data.name}</h1>
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/director/halls">
            <ArrowRight className="size-4" /> بازگشت
          </Link>
        </Button>
      </div>
      <HallBuilder hallId={hallId} hallName={data.name} />
    </div>
  );
}
