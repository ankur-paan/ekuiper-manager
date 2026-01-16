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
  const activeServerIdRef = React.useRef(activeServerId);
  const activeServerUrl = activeServer?.url;

  React.useEffect(() => {
    activeServerIdRef.current = activeServerId;
  }, [activeServerId]);

  const checkHealth = React.useCallback(async () => {
    if (!activeServerId || !activeServerUrl) {
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
          "X-EKuiper-URL": activeServerUrl,
        },
      });

      const isHealthy = response.ok;

      setHealth({
        isHealthy,
        lastChecked: new Date(),
        error: isHealthy ? null : `Server responded with ${response.status}`,
      });

      const newStatus: ServerStatus = isHealthy ? "connected" : "error";
      updateServer(activeServerId, {
        status: newStatus,
        lastConnected: isHealthy ? new Date() : undefined,
      });
    } catch (error) {
      setHealth({
        isHealthy: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Connection failed",
      });

      updateServer(activeServerId, {
        status: "error",
      });
    } finally {
      setIsChecking(false);
    }
  }, [activeServerId, activeServerUrl, updateServer]);

  // Initial check - only once per server after hydration
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServerId || !activeServerUrl) return;

    // Only do initial check once per session or server change
    if (!hasInitialCheck.current) {
      hasInitialCheck.current = true;
      checkHealth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServerId, activeServerUrl]);

  // Reset initial check flag when server changes
  React.useEffect(() => {
    hasInitialCheck.current = false;
  }, [activeServerId]);

  // Periodic health checks
  React.useEffect(() => {
    if (!_hasHydrated || !enabled || !activeServerId || !activeServerUrl) return;

    const intervalId = setInterval(checkHealth, interval);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, enabled, activeServerId, activeServerUrl, interval]);

  return {
    ...health,
    isChecking,
    checkHealth,
  };
}
