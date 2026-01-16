"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";

export interface SystemInfo {
  version: string;
  os: string;
  arch?: string;
  upTimeSeconds: number;
  cpuUsage?: number;
  memoryUsage?: number;
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

  const fetchSystemInfo = React.useCallback(async () => {
    if (!activeServer) {
      setError("No server selected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ekuiper/`, {
        method: "GET",
        headers: {
          "X-EKuiper-URL": activeServer.url,
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
  }, [activeServer]);

  // Initial fetch - wait for hydration
  React.useEffect(() => {
    if (!_hasHydrated) return;
    if (enabled && activeServer) {
      fetchSystemInfo();
    }
    // fetchSystemInfo is excluded from deps to avoid infinite loop
    // It's recreated when activeServer changes, which is already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServer]);

  // Periodic refresh
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServer || !refetchInterval) return;

    const intervalId = setInterval(fetchSystemInfo, refetchInterval);

    return () => clearInterval(intervalId);
    // fetchSystemInfo is excluded from deps to avoid infinite loop
    // It's recreated when activeServer changes, which is already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServer, refetchInterval]);

  return {
    data,
    error,
    isLoading,
    refetch: fetchSystemInfo,
  };
}
