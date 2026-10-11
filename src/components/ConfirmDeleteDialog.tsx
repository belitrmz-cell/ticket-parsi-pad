import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Confirmation dialog that requires typing the word «حذف» exactly. */
export function ConfirmDeleteDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (busy) return;
    setText("");
    onCancel();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">{message}</p>
        <p className="text-sm text-muted-foreground">برای تأیید، کلمه حذف را دقیقاً وارد کنید.</p>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="حذف" />
        <div className="flex gap-2 pt-2">
          <Button
            variant="destructive"
            disabled={text.trim() !== "حذف" || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setText("");
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} حذف
          </Button>
          <Button variant="ghost" disabled={busy} onClick={close}>
            انصراف
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
