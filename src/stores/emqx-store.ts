/**
 * EMQX Connection Store
 * Manages EMQX server connection details and authentication state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { emqxClient } from "@/lib/emqx/client";
import { toast } from "sonner";
import { EMQXClientInfo } from "@/lib/emqx/types";

export interface EmqxConnection {
    url: string;      // API URL (http://locahost:18083)
    wsUrl: string;    // WebSocket URL (ws://localhost:8083/mqtt)

    // Management API Credentials (for Topic Discovery, Auth)
    username: string;
    token?: string;
    isAuthenticated: boolean;
    wsConnected: boolean;
    supabaseConnected: boolean;
    version?: string;

    // MQTT Data Credentials (for Live Preview)
    mqttUsername?: string;
    mqttPassword?: string;
}

interface EmqxState {
    // Config
    connection: EmqxConnection;

    // State
    isConnecting: boolean;
    error: string | null;
    activeTopics: string[];

    // Actions
    configure: (config: Partial<EmqxConnection>) => void;
    login: (password: string) => Promise<boolean>;
    disconnect: () => void;
    fetchTopics: () => Promise<void>;
    initialize: () => Promise<void>;
}

export const useEmqxStore = create<EmqxState>()(
    persist(
        (set, get) => ({
            connection: {
                url: process.env.NEXT_PUBLIC_EMQX_URL || "http://localhost:18083",
                wsUrl: process.env.NEXT_PUBLIC_EMQX_WS_URL || "ws://localhost:8083/mqtt",
                username: "admin", // Default Management API User
                mqttUsername: process.env.NEXT_PUBLIC_MQTT_USERNAME,
                mqttPassword: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
                token: undefined,
                isAuthenticated: false,
                wsConnected: false,
                supabaseConnected: false,
            },
            isConnecting: false,
            error: null,
            activeTopics: [],

            configure: (config) => {
                set((state) => ({
                    connection: { ...state.connection, ...config },
                    // Reset auth if key params change
                    ...(config.url || config.username ? { isAuthenticated: false } : {}),
                }));
            },

            login: async (password: string) => {
                const { connection } = get();
                set({ isConnecting: true, error: null });

                try {
                    // 1. Authenticate with REST API
                    const response = await emqxClient.login(
                        connection.url,
                        connection.username,
                        password
                    );

                    set((state) => ({
                        connection: {
                            ...state.connection,
                            token: response.token,
                            isAuthenticated: true,
                            version: response.version,
                        },
                        isConnecting: false,
                    }));

                    toast.success("Connected to EMQX REST API");
                    return true;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : "Authentication failed";
                    set({ error: msg, isConnecting: false });
                    toast.error(msg);
                    return false;
                }
            },

            disconnect: () => {
                emqxClient.clearCredentials();
                set((state) => ({
                    connection: {
                        ...state.connection,
                        token: undefined,
                        isAuthenticated: false,
                    },
                    activeTopics: [],
                }));
            },

            fetchTopics: async () => {
                try {
                    const topics = await emqxClient.getActiveTopics();
                    set({ activeTopics: topics.map(t => t.topic) });
                } catch (err) {
                    console.error("Failed to fetch topics", err);
                }
            },

            initialize: async () => {
                const { connection, login } = get();

                // Fetch latest config from server (reads .env)
                try {
                    const res = await fetch('/api/config');
                    if (res.ok) {
                        const config = await res.json();
                        const emqx = config.emqx;

                        // Update connection settings if new values exist
                        set(state => ({
                            connection: {
                                ...state.connection,
                                url: emqx.url || state.connection.url,
                                wsUrl: emqx.wsUrl || state.connection.wsUrl,
                                // Map emqx.username/password (likely from .env MQTT_USERNAME) to MQTT credentials
                                // Leave Management API username as "admin" default unless we add specific ENV for it later
                                mqttUsername: emqx.username || state.connection.mqttUsername,
                                mqttPassword: emqx.password || state.connection.mqttPassword,
                            }
                        }));
                    }
                } catch (e) {
                    console.warn("Auto-config failed", e);
                }
            }
        }),
        {
            name: "emqx-store-v1",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                connection: state.connection,
                // Don't persist activeTopics for now
            }),
        }
    )
);
