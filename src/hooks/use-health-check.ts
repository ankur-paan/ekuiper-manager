"use client";

import * as React from "react";
import { useServerStore, ServerStatus } from "@/stores/server-store";

interface HealthCheckResult {
  isHealthy: boolean;
  lastChecked: Date | null;
  error: string | null;
}

interface UseHealthCheckOptions {
  interval?: number; // in milliseconds
  enabled?: boolean;
}

export function useHealthCheck(options: UseHealthCheckOptions = {}) {
  // Default to 60 seconds to reduce polling frequency
  const { interval = 60000, enabled = true } = options;
  const { servers, activeServerId, updateServer, _hasHydrated } = useServerStore();
  const [health, setHealth] = React.useState<HealthCheckResult>({
    isHealthy: false,
    lastChecked: null,
    error: null,
  });
  const [isChecking, setIsChecking] = React.useState(false);

  // Use ref to track if we've done initial check
  const hasInitialCheck = React.useRef(false);

  const activeServer = servers.find((s) => s.id === activeServerId);

  const checkHealth = React.useCallback(async () => {
    if (!activeServer) {
      setHealth({
        isHealthy: false,
        lastChecked: new Date(),
        error: "No server selected",
      });
      return;
    }

    setIsChecking(true);

    try {
      const response = await fetch(`/api/ekuiper/ping`, {
        method: "GET",
        headers: {
          "X-EKuiper-URL": activeServer.url,
        },
      });

      const isHealthy = response.ok;

      setHealth({
        isHealthy,
        lastChecked: new Date(),
        error: isHealthy ? null : `Server responded with ${response.status}`,
      });

      const newStatus: ServerStatus = isHealthy ? "connected" : "error";
      updateServer(activeServer.id, {
        status: newStatus,
        lastConnected: isHealthy ? new Date() : activeServer.lastConnected,
      });
    } catch (error) {
      setHealth({
        isHealthy: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Connection failed",
      });

      updateServer(activeServer.id, {
        status: "error",
      });
    } finally {
      setIsChecking(false);
    }
  }, [activeServer, updateServer]);

  // Initial check - only once per server after hydration
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServer) return;

    // Only do initial check once per session
    if (!hasInitialCheck.current) {
      hasInitialCheck.current = true;
      checkHealth();
    }
    // checkHealth is excluded from deps to avoid infinite loop
    // It's recreated when activeServer/updateServer change, which are already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServer]);

  // Reset initial check flag when server changes
  React.useEffect(() => {
    hasInitialCheck.current = false;
  }, [activeServer]);

  // Periodic health checks
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServer) return;

    const intervalId = setInterval(checkHealth, interval);

    return () => clearInterval(intervalId);
    // checkHealth is excluded from deps to avoid infinite loop
    // It's recreated when activeServer/updateServer change, which are already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServer, interval]);

  return {
    ...health,
    isChecking,
    checkHealth,
  };
}
