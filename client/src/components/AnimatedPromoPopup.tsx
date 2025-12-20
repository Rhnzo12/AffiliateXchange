import { Sparkles, Clock3 } from "lucide-react";
import { Button } from "./ui/button";

type AnimatedPromoPopupProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  highlight?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};

export function AnimatedPromoPopup({
  open,
  onClose,
  title,
  message,
  highlight,
  primaryActionLabel = "Got it",
  secondaryActionLabel = "Maybe later",
}: AnimatedPromoPopupProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-700 ease-in-out ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-700 ease-in-out"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-card/95 shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.33,1,0.68,1)] ${
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-10 scale-95 opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
        <div className="absolute -left-24 -top-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative space-y-5 p-6">
          {highlight ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Clock3 className="h-4 w-4" />
              {highlight}
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold leading-tight">{title}</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="transition-transform duration-300 ease-out hover:-translate-y-0.5"
            >
              {secondaryActionLabel}
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              className="shadow-sm transition-transform duration-500 ease-out hover:-translate-y-0.5"
            >
              {primaryActionLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
