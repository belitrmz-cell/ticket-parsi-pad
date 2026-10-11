import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { OperatorGate } from "@/components/OperatorGate";
import { EntryScanner } from "@/components/EntryScanner";
import { getDeviceId } from "@/lib/device";

export const Route = createFileRoute("/entry/$token")({
  head: () => ({
    meta: [
      { title: "کنترل ورود | سامانه بلیت" },
      { name: "description", content: "ورود اپراتور کنترل ورودی برای بررسی و اسکن بلیت‌ها." },
      { property: "og:title", content: "کنترل ورود" },
      { property: "og:description", content: "ورود اپراتور کنترل ورودی برای بررسی و اسکن بلیت‌ها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntryPage,
});

function EntryPage() {
  const { token } = useParams({ from: "/entry/$token" });
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => setDeviceId(getDeviceId()), []);

  return (
    <OperatorGate kind="entry" token={token} title="کنترل ورود">
      {({ operatorName, sessionToken }) =>
        deviceId ? (
          <EntryScanner
            token={token}
            deviceId={deviceId}
            sessionToken={sessionToken}
            operatorName={operatorName}
          />
        ) : null
      }
    </OperatorGate>
  );
}

