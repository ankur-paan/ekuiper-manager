/**
 * Supabase Client for Historical Data Access
 * Used in Query Designer for lookup tables and data enrichment
 * 
 * Based on Supabase JS documentation from Context7
 */

import type {
    SupabaseCredentials,
    SupabaseConnectionTestResult,
    SupabaseTable,
    SupabaseColumn,
    SupabaseQueryOptions,
    SupabaseQueryResult,
    RealtimeEventType,
    RealtimeCallback,
} from './types';
import { SUPABASE_STORAGE_KEY } from './types';

// =============================================================================
// Supabase Client Class
// =============================================================================

export class SupabaseClient {
    private projectUrl: string = '';
    private anonKey: string = '';

    constructor() {
        this.loadFromStorage();
    }

    // ===========================================================================
    // Configuration Methods
    // ===========================================================================

    /**
     * Configure the Supabase client
     */
    configure(projectUrl: string, anonKey: string): void {
        this.projectUrl = projectUrl.replace(/\/$/, '');
        this.anonKey = anonKey;
    }

    /**
     * Check if client is configured
     */
    isConfigured(): boolean {
        return !!this.projectUrl && !!this.anonKey;
    }

    /**
     * Get current configuration
     */
    getConfig(): SupabaseCredentials {
        return {
            projectUrl: this.projectUrl,
            anonKey: this.anonKey,
        };
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
            const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
            if (stored) {
                const parsed: SupabaseCredentials = JSON.parse(stored);
                this.projectUrl = parsed.projectUrl || '';
                this.anonKey = parsed.anonKey || '';
            }
        } catch {
            // Ignore parse errors
        }
    }

    /**
     * Save credentials to localStorage
     */
    saveToStorage(): void {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(
                SUPABASE_STORAGE_KEY,
                JSON.stringify({
                    projectUrl: this.projectUrl,
                    anonKey: this.anonKey,
                })
            );
        } catch {
            console.warn('Failed to save Supabase credentials');
        }
    }

    /**
     * Clear stored credentials
     */
    clearCredentials(): void {
        if (typeof window === 'undefined') return;

        localStorage.removeItem(SUPABASE_STORAGE_KEY);
        this.projectUrl = '';
        this.anonKey = '';
    }

    // ===========================================================================
    // HTTP Request Helper
    // ===========================================================================

    /**
     * Make authenticated request to Supabase REST API
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        if (!this.isConfigured()) {
            throw new Error('Supabase not configured');
        }

        const url = `${this.projectUrl}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            'Prefer': 'return=representation',
            ...(options.headers as Record<string, string>),
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Supabase API error: ${response.status} - ${errorText}`);
        }

        const text = await response.text();
        if (!text) return [] as unknown as T;

        return JSON.parse(text);
    }

    // ===========================================================================
    // Connection Test
    // ===========================================================================

    /**
     * Test connection to Supabase
     */
    async testConnection(
        projectUrl?: string,
        anonKey?: string
    ): Promise<SupabaseConnectionTestResult> {
        // Temporarily use provided credentials if given
        const origUrl = this.projectUrl;
        const origKey = this.anonKey;

        if (projectUrl && anonKey) {
            this.configure(projectUrl, anonKey);
        }

        try {
            // Try to list tables (requires postgres_meta extension)
            // Fallback: just make a simple request
            const response = await fetch(`${this.projectUrl}/rest/v1/`, {
                method: 'GET',
                headers: {
                    'apikey': this.anonKey,
                    'Authorization': `Bearer ${this.anonKey}`,
                },
            });

            // Restore original credentials if we used temp ones
            if (projectUrl && anonKey) {
                this.projectUrl = origUrl;
                this.anonKey = origKey;
            }

            if (response.ok || response.status === 404) {
                return {
                    success: true,
                    message: 'Connection successful',
                };
            }

            return {
                success: false,
                message: `HTTP ${response.status}: ${response.statusText}`,
            };
        } catch (error) {
            // Restore original credentials
            if (projectUrl && anonKey) {
                this.projectUrl = origUrl;
                this.anonKey = origKey;
            }

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    // ===========================================================================
    // Table Methods
    // ===========================================================================

    /**
     * List available tables (via OpenAPI spec)
     * Note: Requires public schema tables to be exposed via PostgREST
     */
    async listTables(): Promise<SupabaseTable[]> {
        try {
            // Fetch OpenAPI spec to get table list
            const spec = await this.request<{
                paths: Record<string, unknown>;
                definitions?: Record<string, { properties?: Record<string, unknown> }>;
            }>('/rest/v1/', {
                headers: {
                    'Accept': 'application/openapi+json',
                },
            });

            const tables: SupabaseTable[] = [];

            // Extract table names from paths (format: /tablename)
            if (spec.paths) {
                for (const path of Object.keys(spec.paths)) {
                    if (path.startsWith('/') && !path.includes(':')) {
                        const tableName = path.slice(1);
                        if (tableName && tableName !== 'rpc') {
                            const columns: SupabaseColumn[] = [];

                            // Try to get columns from definitions
                            const def = spec.definitions?.[tableName];
                            if (def?.properties) {
                                for (const [colName, colDef] of Object.entries(def.properties)) {
                                    const col = colDef as { type?: string; format?: string };
                                    columns.push({
                                        name: colName,
                                        type: col.format || col.type || 'unknown',
                                        isNullable: true,
                                        isPrimaryKey: false,
                                    });
                                }
                            }

                            tables.push({
                                name: tableName,
                                schema: 'public',
                                columns: columns.length > 0 ? columns : undefined,
                            });
                        }
                    }
                }
            }

            return tables;
        } catch (error) {
            console.warn('Failed to list tables:', error);
            return [];
        }
    }

    /**
     * Get table schema/columns
     */
    async getTableSchema(tableName: string): Promise<SupabaseColumn[]> {
        const tables = await this.listTables();
        const table = tables.find((t) => t.name === tableName);
        return table?.columns || [];
    }

    // ===========================================================================
    // Query Methods
    // ===========================================================================

    /**
     * Query data from a table
     */
    async query<T = Record<string, unknown>>(
        tableName: string,
        options: SupabaseQueryOptions = {}
    ): Promise<SupabaseQueryResult<T>> {
        try {
            const params = new URLSearchParams();

            // Select columns
            if (options.select) {
                params.set('select', options.select);
            }

            // Build query string
            let query = `/rest/v1/${encodeURIComponent(tableName)}`;
            const queryParams = params.toString();
            if (queryParams) {
                query += `?${queryParams}`;
            }

            // Build headers for filters, ordering, pagination
            const headers: Record<string, string> = {};

            // Ordering
            if (options.order) {
                const dir = options.order.ascending ? 'asc' : 'desc';
                headers['Range-Unit'] = 'items';
                query += (query.includes('?') ? '&' : '?') +
                    `order=${options.order.column}.${dir}`;
            }

            // Pagination
            if (options.limit !== undefined || options.offset !== undefined) {
                const start = options.offset || 0;
                const end = start + (options.limit || 100) - 1;
                headers['Range'] = `${start}-${end}`;
                headers['Prefer'] = 'count=exact';
            }

            const data = await this.request<T[]>(query, { headers });

            return { data };
        } catch (error) {
            return {
                data: [],
                error: error instanceof Error ? error.message : 'Query failed',
            };
        }
    }

    /**
     * Get sample data from a table (for preview)
     */
    async getSampleData(
        tableName: string,
        limit: number = 10
    ): Promise<Record<string, unknown>[]> {
        const result = await this.query(tableName, { limit });
        return result.data;
    }

    // ===========================================================================
    // Realtime Methods (using native EventSource/WebSocket)
    // ===========================================================================

    /**
     * Subscribe to realtime changes on a table
     * Uses Supabase Realtime broadcast channel
     * 
     * Note: This is a simplified implementation. For full realtime support,
     * consider using the official @supabase/supabase-js client.
     */
    subscribeToTable(
        tableName: string,
        eventType: RealtimeEventType,
        callback: RealtimeCallback
    ): { unsubscribe: () => void } {
        // For now, return a dummy subscription
        // Full implementation would use WebSocket to Supabase Realtime
        console.log(`[Supabase] Subscribed to ${tableName} for ${eventType} events`);

        // Note: Full realtime implementation requires WebSocket connection
        // to wss://[project].supabase.co/realtime/v1/websocket
        // This is a placeholder for the Query Designer preview

        return {
            unsubscribe: () => {
                console.log(`[Supabase] Unsubscribed from ${tableName}`);
            },
        };
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const supabaseClient = new SupabaseClient();

// Named export for use in components
export { SupabaseClient as SupabaseClientClass };
