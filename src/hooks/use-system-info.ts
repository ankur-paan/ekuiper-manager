"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";

export interface SystemInfo {
  version: string;
  os: string;
  arch?: string;
  upTimeSeconds: number;
  cpuUsage?: string | number;
  memoryUsed?: string;
  memoryTotal?: string;
}

interface UseSystemInfoOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useSystemInfo(options: UseSystemInfoOptions = {}) {
  const { enabled = true, refetchInterval } = options;
  const { servers, activeServerId, _hasHydrated } = useServerStore();
  const [data, setData] = React.useState<SystemInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const activeServer = servers.find((s) => s.id === activeServerId);

  const activeServerUrl = activeServer?.url;

  const fetchSystemInfo = React.useCallback(async () => {
    if (!activeServerUrl) {
      setError("No server selected");
      return;
    }

    if (!data) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/`, {
        method: "GET",
        headers: {
          "X-EKuiper-URL": activeServerUrl,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system info: ${response.status}`);
      }

      const info = await response.json();
      setData(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch system info");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeServerUrl]);

  // Initial fetch - wait for hydration
  React.useEffect(() => {
    if (!_hasHydrated) return;
    if (enabled && activeServerUrl) {
      fetchSystemInfo();
    }
  }, [_hasHydrated, enabled, activeServerUrl, fetchSystemInfo]);

  // Periodic refresh
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServerUrl || !refetchInterval) return;

    const intervalId = setInterval(fetchSystemInfo, refetchInterval);

    return () => clearInterval(intervalId);
  }, [_hasHydrated, enabled, activeServerUrl, refetchInterval, fetchSystemInfo]);

  return {
    data,
    error,
    isLoading,
    refetch: fetchSystemInfo,
  };
}
