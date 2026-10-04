"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Power } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const variantConfig: Record<
  ConfirmVariant,
  { icon: typeof AlertTriangle; iconClass: string; buttonClass: string; iconBgClass: string }
> = {
  danger: {
    icon: Trash2,
    iconClass: "text-destructive",
    buttonClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    iconBgClass: "bg-destructive/10",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600 dark:text-amber-400",
    buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
    iconBgClass: "bg-amber-500/10",
  },
  info: {
    icon: Power,
    iconClass: "text-primary",
    buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90",
    iconBgClass: "bg-primary/10",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                config.iconBgClass
              )}
            >
              <Icon className={cn("size-5", config.iconClass)} aria-hidden="true" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading || loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isLoading || loading}
            className={config.buttonClass}
          >
            {(isLoading || loading) && (
              <span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
