import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/ui/dialog";
import { Button } from "@/components/common/ui/button";
import { Loader2, TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-background/95 text-foreground shadow-2xl backdrop-blur">
        <DialogHeader className="text-left">
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg">{title}</DialogTitle>
              <DialogDescription className="mt-2 leading-6">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading}
            variant={destructive ? "destructive" : "default"}
            onClick={() => void onConfirm()}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
