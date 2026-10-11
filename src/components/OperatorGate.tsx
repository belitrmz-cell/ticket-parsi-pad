import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deviceStatus, requestAccess } from "@/lib/operators.functions";
import { describeDevice, getDeviceId } from "@/lib/device";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Device-approval gate shared by the booth and entry links. */
export function OperatorGate({
  kind,
  token,
  title,
  children,
}: {
  kind: "booth" | "entry";
  token: string;
  title: string;
  children: (ctx: { operatorName: string; sessionToken: string }) => ReactNode;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => setDeviceId(getDeviceId()), []);

  const label = useMemo(
    () => (typeof navigator === "undefined" ? "" : describeDevice(navigator.userAgent)),
    [],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["device-status", kind, token, deviceId],
    queryFn: () => deviceStatus({ data: { kind, token, deviceId } }),
    enabled: !!deviceId,
    refetchInterval: 10000,
  });

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("نام اپراتور را وارد کنید.");
      return;
    }
    setSending(true);
    try {
      await requestAccess({
        data: { kind, token, deviceId, operatorName: name.trim(), deviceLabel: label },
      });
      await refetch();
      toast.success("درخواست دسترسی ارسال شد.");
    } catch {
      toast.error("ارسال درخواست ناموفق بود.");
    }
    setSending(false);
  };

  if (!deviceId || isLoading || !data) return <Center><Loader2 className="size-6 animate-spin text-primary" /></Center>;

  if (data.state === "approved")
    return <>{children({ operatorName: data.operatorName, sessionToken: data.sessionToken })}</>;

  if (data.state === "new")
    return (
      <Center>
        <div className="panel w-full max-w-sm p-6">
          <h1 className="gold-text text-center text-xl font-bold">{title}</h1>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            کارگردان: {data.directorName}
          </p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="op">نام اپراتور</Label>
            <Input id="op" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">دستگاه: {label}</p>
          </div>
          <Button className="mt-4 w-full" disabled={sending} onClick={() => void submit()}>
            ارسال درخواست دسترسی
          </Button>
        </div>
      </Center>
    );

  const messages: Record<string, string> = {
    invalid: "این لینک معتبر نیست.",
    pending: "درخواست شما ارسال شد و در انتظار تأیید کارگردان است.",
    revoked: "دسترسی این دستگاه لغو شده است.",
    disabled: "دسترسی این دستگاه موقتاً غیرفعال است.",
    full: "ظرفیت اپراتورهای همزمان تکمیل است. کمی بعد دوباره تلاش کنید.",
  };

  return (
    <Center>
      <div className="panel w-full max-w-sm p-8 text-center">
        <h1 className="gold-text text-lg font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-7">{messages[data.state]}</p>
        {data.state === "pending" ? (
          <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />
        ) : null}
      </div>
    </Center>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-dvh items-center justify-center px-5 py-10">
      {children}
    </div>
  );
}
