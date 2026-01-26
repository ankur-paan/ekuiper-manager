/**
 * EMQX REST API Client
 * Based on EMQX v5 REST API documentation from Context7
 * 
 * Features:
 * - Bearer token authentication via /api/v5/login
 * - Token storage in localStorage with expiry
 * - Client listing with cursor pagination
 * - Subscription listing for topic discovery
 * - Unique topic aggregation from active subscriptions
 */

import type {
    EMQXLoginRequest,
    EMQXLoginResponse,
    EMQXCredentials,
    EMQXClientInfo,
    EMQXClientListResponse,
    EMQXSubscription,
    EMQXSubscriptionListResponse,
    EMQXTopic,
    EMQXConnectionTestResult,
} from './types';
import { EMQX_STORAGE_KEYS } from './types';

// =============================================================================
// EMQX Client Class
// =============================================================================

export class EMQXClient {
    private serverUrl: string = '';
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private timeout: number;

    constructor(serverUrl?: string, timeout: number = 30000) {
        this.timeout = timeout;
        if (serverUrl) {
            this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
        }
        this.loadFromStorage();
    }

    // ===========================================================================
    // Configuration Methods
    // ===========================================================================

    /**
     * Set the EMQX server URL
     */
    setServerUrl(url: string): void {
        this.serverUrl = url.replace(/\/$/, '');
    }

    /**
     * Get current server URL
     */
    getServerUrl(): string {
        return this.serverUrl;
    }

    /**
     * Check if client is configured
     */
    isConfigured(): boolean {
        return !!this.serverUrl;
    }

    /**
     * Check if authenticated with valid token
     */
    isAuthenticated(): boolean {
        return !!this.token && Date.now() < this.tokenExpiry;
    }

    // ===========================================================================
    // Storage Methods
    // ===========================================================================

    /**
     * Load credentials from localStorage
     */
    private loadFromStorage(): void {
        if (typeof window === 'undefined') return;

        try {
            const credentialsJson = localStorage.getItem(EMQX_STORAGE_KEYS.CREDENTIALS);
            if (credentialsJson) {
                const credentials: EMQXCredentials = JSON.parse(credentialsJson);
                this.serverUrl = credentials.serverUrl || '';
                this.token = credentials.token || null;
                this.tokenExpiry = credentials.tokenExpiry || 0;
            }
        } catch (error) {
            console.warn('Failed to load EMQX credentials from storage:', error);
        }
    }

    /**
     * Save credentials to localStorage
     */
    private saveToStorage(credentials: Partial<EMQXCredentials>): void {
        if (typeof window === 'undefined') return;

        try {
            const existing = this.getStoredCredentials();
            const updated: EMQXCredentials = {
                ...existing,
                ...credentials,
                serverUrl: credentials.serverUrl || existing.serverUrl || this.serverUrl,
            };
            localStorage.setItem(EMQX_STORAGE_KEYS.CREDENTIALS, JSON.stringify(updated));
        } catch (error) {
            console.warn('Failed to save EMQX credentials to storage:', error);
        }
    }

    /**
     * Get stored credentials
     */
    getStoredCredentials(): EMQXCredentials {
        if (typeof window === 'undefined') {
            return { serverUrl: '', username: '', password: '' };
        }

        try {
            const json = localStorage.getItem(EMQX_STORAGE_KEYS.CREDENTIALS);
            if (json) {
                return JSON.parse(json);
            }
        } catch {
            // Ignore parse errors
        }
        return { serverUrl: '', username: '', password: '' };
    }

    /**
     * Clear stored credentials
     */
    clearCredentials(): void {
        if (typeof window === 'undefined') return;

        localStorage.removeItem(EMQX_STORAGE_KEYS.CREDENTIALS);
        this.token = null;
        this.tokenExpiry = 0;
        this.serverUrl = '';
    }

    // ===========================================================================
    // HTTP Request Helper
    // ===========================================================================

    /**
     * Make authenticated request to EMQX API
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        if (!this.serverUrl) {
            throw new Error('EMQX server URL not configured');
        }

        const url = `${this.serverUrl}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        // Add Bearer token if available
        if (this.token && this.isAuthenticated()) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`EMQX API error: ${response.status} - ${errorText}`);
            }

            // Handle empty responses
            const text = await response.text();
            if (!text) {
                return {} as T;
            }

            return JSON.parse(text);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // ===========================================================================
    // Authentication Methods
    // ===========================================================================

    /**
     * Login to EMQX and get Bearer token
     * POST /api/v5/login
     */
    async login(
        serverUrl: string,
        username: string,
        password: string
    ): Promise<EMQXLoginResponse> {
        this.serverUrl = serverUrl.replace(/\/$/, '');

        const body: EMQXLoginRequest = { username, password };

        const response = await this.request<EMQXLoginResponse>('/api/v5/login', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        // Store token with 1 hour expiry (EMQX default)
        this.token = response.token;
        this.tokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

        // Save to localStorage
        this.saveToStorage({
            serverUrl: this.serverUrl,
            username,
            password, // Note: Consider encrypting in production
            token: this.token,
            tokenExpiry: this.tokenExpiry,
        });

        return response;
    }

    /**
     * Test connection to EMQX
     */
    async testConnection(
        serverUrl: string,
        username: string,
        password: string
    ): Promise<EMQXConnectionTestResult> {
        try {
            const response = await this.login(serverUrl, username, password);
            return {
                success: true,
                message: 'Connection successful',
                version: response.version,
                edition: response.license?.edition,
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    /**
     * Ensure we have a valid token, re-authenticate if needed
     */
    private async ensureAuthenticated(): Promise<void> {
        if (this.isAuthenticated()) return;

        const credentials = this.getStoredCredentials();
        if (!credentials.username || !credentials.password) {
            throw new Error('EMQX credentials not configured. Please login first.');
        }

        await this.login(
            credentials.serverUrl || this.serverUrl,
            credentials.username,
            credentials.password
        );
    }

    // ===========================================================================
    // Client Methods
    // ===========================================================================

    /**
     * List connected clients with cursor pagination
     * GET /api/v5/clients_v2
     */
    async listClients(
        cursor?: string,
        limit: number = 100
    ): Promise<EMQXClientListResponse> {
        await this.ensureAuthenticated();

        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (cursor) {
            params.set('cursor', cursor);
        }

        return this.request<EMQXClientListResponse>(
            `/api/v5/clients_v2?${params.toString()}`
        );
    }

    /**
     * Get all clients (handles pagination)
     */
    async getAllClients(): Promise<EMQXClientInfo[]> {
        const allClients: EMQXClientInfo[] = [];
        let cursor: string | undefined;

        do {
            const response = await this.listClients(cursor, 500);
            allClients.push(...response.data);
            cursor = response.meta.hasnext ? response.meta.cursor : undefined;
        } while (cursor);

        return allClients;
    }

    /**
     * Get client by ID
     * GET /api/v5/clients/:clientid
     */
    async getClient(clientId: string): Promise<EMQXClientInfo | null> {
        await this.ensureAuthenticated();

        try {
            const response = await this.request<{ data: EMQXClientInfo[] }>(
                `/api/v5/clients/${encodeURIComponent(clientId)}`
            );
            return response.data?.[0] || null;
        } catch {
            return null;
        }
    }

    // ===========================================================================
    // Subscription Methods
    // ===========================================================================

    /**
     * List subscriptions
     * GET /api/v5/subscriptions
     */
    async listSubscriptions(
        options: {
            clientId?: string;
            topic?: string;
            cursor?: string;
            limit?: number;
        } = {}
    ): Promise<EMQXSubscriptionListResponse> {
        await this.ensureAuthenticated();

        const params = new URLSearchParams();
        params.set('limit', String(options.limit || 500));
        if (options.clientId) {
            params.set('clientid', options.clientId);
        }
        if (options.topic) {
            params.set('topic', options.topic);
        }
        if (options.cursor) {
            params.set('cursor', options.cursor);
        }

        return this.request<EMQXSubscriptionListResponse>(
            `/api/v5/subscriptions?${params.toString()}`
        );
    }

    /**
     * Get all subscriptions (handles pagination)
     */
    async getAllSubscriptions(): Promise<EMQXSubscription[]> {
        const allSubs: EMQXSubscription[] = [];
        let cursor: string | undefined;

        do {
            const response = await this.listSubscriptions({ cursor, limit: 500 });
            allSubs.push(...response.data);
            cursor = response.meta.hasnext ? response.meta.cursor : undefined;
        } while (cursor);

        return allSubs;
    }

    /**
     * Get subscriptions for a specific client
     */
    async getClientSubscriptions(clientId: string): Promise<EMQXSubscription[]> {
        const response = await this.listSubscriptions({ clientId, limit: 1000 });
        return response.data;
    }

    // ===========================================================================
    // Topic Discovery Methods
    // ===========================================================================

    /**
     * Get all unique topics from active subscriptions
     * This is the primary method for topic discovery since EMQX doesn't have
     * a direct "list all published topics" API
     */
    async getActiveTopics(): Promise<EMQXTopic[]> {
        const subscriptions = await this.getAllSubscriptions();

        // Aggregate unique topics with subscriber count
        const topicMap = new Map<string, EMQXTopic>();

        for (const sub of subscriptions) {
            const existing = topicMap.get(sub.topic);
            if (existing) {
                existing.subscriberCount++;
            } else {
                topicMap.set(sub.topic, {
                    topic: sub.topic,
                    subscriberCount: 1,
                    lastSeen: new Date().toISOString(),
                });
            }
        }

        // Sort by subscriber count (most popular first)
        return Array.from(topicMap.values()).sort(
            (a, b) => b.subscriberCount - a.subscriberCount
        );
    }

    /**
     * Search topics by pattern (supports wildcards)
     */
    async searchTopics(pattern: string): Promise<EMQXTopic[]> {
        const allTopics = await this.getActiveTopics();

        if (!pattern) return allTopics;

        // Convert MQTT wildcard pattern to regex
        const regexPattern = pattern
            .replace(/\+/g, '[^/]+')
            .replace(/#/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);

        return allTopics.filter((t) => regex.test(t.topic));
    }

    /**
     * Get topic tree structure for UI display
     */
    async getTopicTree(): Promise<Record<string, unknown>> {
        const topics = await this.getActiveTopics();
        const tree: Record<string, unknown> = {};

        for (const { topic, subscriberCount } of topics) {
            const parts = topic.split('/');
            let current: Record<string, unknown> = tree;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = i === parts.length - 1
                        ? { _subscriberCount: subscriberCount, _topic: topic }
                        : {};
                }
                current = current[part] as Record<string, unknown>;
            }
        }

        return tree;
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const emqxClient = new EMQXClient();

// Named export for use in components
export { EMQXClient as EMQXClientClass };
