"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

type StatusVariant = "success" | "error" | "warning" | "pending" | "info" | "running" | "stopped";

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<
  StatusVariant,
  { icon: typeof CheckCircle; className: string; defaultLabel: string }
> = {
  success: {
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    defaultLabel: "Success",
  },
  running: {
    icon: Loader2,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    defaultLabel: "Running",
  },
  error: {
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    defaultLabel: "Error",
  },
  stopped: {
    icon: XCircle,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    defaultLabel: "Stopped",
  },
  warning: {
    icon: AlertCircle,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    defaultLabel: "Warning",
  },
  pending: {
    icon: Clock,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    defaultLabel: "Pending",
  },
  info: {
    icon: AlertCircle,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    defaultLabel: "Info",
  },
};

export function StatusBadge({
  status,
  label,
  className,
  showIcon = true,
}: StatusBadgeProps) {
  // Map common eKuiper statuses to our variants
  const normalizedStatus = status.toLowerCase() as StatusVariant;
  const config = statusConfig[normalizedStatus] || statusConfig.info;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-0 font-medium",
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            "h-3 w-3",
            normalizedStatus === "running" && "animate-spin"
          )}
        />
      )}
      {label || config.defaultLabel}
    </Badge>
  );
}
