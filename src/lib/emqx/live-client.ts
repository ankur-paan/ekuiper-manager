/**
 * EMQX Live Data Client
 * Uses MQTT.js over WebSocket to subscribe to topics and stream live data
 */

import mqtt, { MqttClient } from "mqtt";

export type MessageCallback = (topic: string, message: any) => void;

class EmqxLiveClient {
    private client: MqttClient | null = null;
    private subscriptions: Set<string> = new Set();
    private messageHandlers: Set<MessageCallback> = new Set();
    private statusHandlers: Set<(connected: boolean) => void> = new Set();

    /**
     * Connect to MQTT Broker via WebSocket
     */
    connect(wsUrl: string, options?: mqtt.IClientOptions) {
        if (this.client?.connected) {
            // Already connected?
            if (options) { // Reconnect if new options are provided (simplification)
                this.disconnect();
            } else {
                return;
            }
        }

        // Ensure path is correct for EMQX (usually /mqtt)
        const url = wsUrl;

        try {
            this.client = mqtt.connect(url, {
                clientId: `ekuiper-manager-${Math.random().toString(16).substr(2, 8)}`,
                keepalive: 60,
                protocolId: 'MQTT',
                protocolVersion: 5,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 30 * 1000,
                ...options,
            });

            this.client.on("connect", () => {
                console.log(`[MQTT] Connected to ${url}`);
                this.notifyStatus(true);
                this.resubscribe();
            });

            this.client.on("reconnect", () => {
                // console.log("[MQTT] Reconnecting...");
            });

            this.client.on("close", () => {
                this.notifyStatus(false);
            });

            this.client.on("offline", () => {
                this.notifyStatus(false);
            });

            this.client.on("error", (err) => {
                console.error("[MQTT] Error:", err);
                this.notifyStatus(false);
            });

            this.client.on("message", (topic, payload) => {
                // console.log("[MQTT] Raw Message:", topic, payload.length);
                try {
                    const msg = payload.toString();
                    let data;
                    try {
                        data = JSON.parse(msg);
                    } catch {
                        data = msg;
                    }
                    this.notifyHandlers(topic, data);
                } catch (err) {
                    console.error("[MQTT] Message error:", err);
                }
            });
        } catch (e) {
            console.error("Failed to create MQTT client", e);
            this.notifyStatus(false);
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
            this.notifyStatus(false);
        }
    }

    // ... (subscribe/unsubscribe unchanged)

    subscribe(topic: string) {
        this.subscriptions.add(topic);
        if (this.client?.connected) {
            this.client.subscribe(topic, (err) => {
                if (err) {
                    console.error(`[MQTT] Subscribe error ${topic}:`, err);
                } else {
                    console.log(`[MQTT] Subscribed to ${topic}`);
                }
            });
        }
    }

    unsubscribe(topic: string) {
        this.subscriptions.delete(topic);
        if (this.client?.connected) {
            this.client.unsubscribe(topic);
        }
    }

    publish(topic: string, message: any) {
        if (this.client?.connected) {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            this.client.publish(topic, payload, (err) => {
                if (err) console.error(`[MQTT] Publish error to ${topic}:`, err);
                // else console.log(`[MQTT] Published to ${topic}`);
            });
        } else {
            console.warn("[MQTT] Cannot publish, client not connected");
        }
    }

    onMessage(callback: MessageCallback) {
        this.messageHandlers.add(callback);
        return () => this.messageHandlers.delete(callback);
    }

    onStatusChange(callback: (connected: boolean) => void) {
        this.statusHandlers.add(callback);
        // Invoke immediately with current status
        callback(this.isConnected());
        return () => this.statusHandlers.delete(callback);
    }

    private notifyHandlers(topic: string, msg: any) {
        this.messageHandlers.forEach((handler) => handler(topic, msg));
    }

    private notifyStatus(connected: boolean) {
        this.statusHandlers.forEach(h => h(connected));
    }

    private resubscribe() {
        if (!this.client?.connected) return;
        this.subscriptions.forEach((topic) => {
            this.client?.subscribe(topic);
        });
    }

    isConnected() {
        return this.client?.connected || false;
    }
}

export const emqxLiveClient = new EmqxLiveClient();
