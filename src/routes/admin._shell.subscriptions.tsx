import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/AppShell";
import { AdminSubscriptions } from "@/components/AdminSubscriptions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_shell/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <>
      <PageTitle title="اشتراک‌ها" />
      <Tabs defaultValue="requests" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">درخواست‌های اشتراک</TabsTrigger>
          <TabsTrigger value="plans">اشتراک‌ها</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-4"><AdminSubscriptions view="plans" /></TabsContent>
        <TabsContent value="requests" className="mt-4"><AdminSubscriptions view="requests" /></TabsContent>
      </Tabs>
    </>
  );
}
