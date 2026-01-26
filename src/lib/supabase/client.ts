/**
 * Supabase Client for Historical Data Access
 * Used in Query Designer for lookup tables and data enrichment
 * 
 * Based on Supabase JS official SDK
 */

import { createClient, SupabaseClient as OfficialSupabaseClient } from '@supabase/supabase-js';
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
    private client: OfficialSupabaseClient | null = null;

    constructor() {
        this.loadFromStorage();
        this.initializeClient();
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
        this.initializeClient();
        this.saveToStorage();
    }

    /**
     * Initialize or Re-initialize the official client
     */
    private initializeClient() {
        if (this.projectUrl && this.anonKey) {
            try {
                this.client = createClient(this.projectUrl, this.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                    }
                });
            } catch (error) {
                console.error("Failed to initialize Supabase client", error);
                this.client = null;
            }
        } else {
            this.client = null;
        }
    }

    /**
     * Check if client is configured
     */
    isConfigured(): boolean {
        return !!this.client;
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
     * Load credentials from localStorage or Environment Variables (fallback)
     */
    private loadFromStorage(): void {
        // 1. Load defaults from Environment Variables (always available)
        const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (envUrl && envKey) {
            this.projectUrl = envUrl;
            this.anonKey = envKey;
        }

        // 2. Check localStorage (client-side only), overrides env vars if present
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(SUPABASE_STORAGE_KEY);
            if (stored) {
                const parsed: SupabaseCredentials = JSON.parse(stored);
                // Only override if stored values are non-empty
                if (parsed.projectUrl) this.projectUrl = parsed.projectUrl;
                if (parsed.anonKey) this.anonKey = parsed.anonKey;
            }
        } catch {
            // Ignore parse errors, keep env var defaults
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
        this.client = null;
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
        // Create a temporary client if credentials provided
        let testClient = this.client;

        if (projectUrl && anonKey) {
            try {
                testClient = createClient(projectUrl, anonKey);
            } catch (e) {
                return { success: false, message: 'Invalid URL or Key format' };
            }
        }

        if (!testClient) {
            return { success: false, message: 'Supabase not configured' };
        }

        try {
            // Use a lightweight check - e.g. querying a system table or just auth check
            // Since we might not know any public tables yet, we try to fetch settings or just a generic request
            // Best standard check: Try to sign in anonymously OR just make a simple RPC call if available.
            // Or usually, just listing tables via REST if possible, but the official client doesn't expose meta listing easily without extensions.

            // ALTERNATIVE: Use the REST connection directly for metadata since client doesn't expose table listing easily?
            // Actually, context7 docs show simply initializing and using it.
            // Let's try to fetch a non-existent table and check if we get a 404 (connected) vs Network Error.

            const { error } = await testClient.from('__test_connection__').select('*').limit(1);

            // Code PGRST200 = Table not found, which means we connected successfully to PostgREST
            // Connection refused or invalid API key would typically be different

            if (error && error.code !== 'PGRST200' && error.code !== '42P01') {
                // 42P01 is Postgres "undefined_table"
                console.warn("Connection test warning:", error);
                if (error.message.includes("FetchError") || error.message.includes("Failed by CORS")) {
                    return { success: false, message: error.message };
                }
            }

            return { success: true, message: 'Connection successful' };

        } catch (error) {
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
     * Note: Official SDK doesn't support listing tables natively without `pg_meta`.
     * We will keep the REST/OpenAPI fallback for this specific feature as it is the standard workaround.
     */
    async listTables(): Promise<SupabaseTable[]> {
        if (!this.projectUrl || !this.anonKey) return [];

        try {
            // Fetch OpenAPI spec to get table list (Standard Supabase Pattern for Client-side introspection)
            const response = await fetch(`${this.projectUrl}/rest/v1/`, {
                headers: {
                    'apikey': this.anonKey,
                    'Authorization': `Bearer ${this.anonKey}`,
                    'Accept': 'application/openapi+json',
                },
            });

            if (!response.ok) return [];

            const spec = await response.json();
            const tables: SupabaseTable[] = [];

            if (spec.paths) {
                for (const path of Object.keys(spec.paths)) {
                    if (path.startsWith('/') && !path.includes(':')) {
                        const tableName = path.slice(1);
                        if (tableName && tableName !== 'rpc') {
                            const columns: SupabaseColumn[] = [];
                            const def = spec.definitions?.[tableName];

                            if (def?.properties) {
                                for (const [colName, colDef] of Object.entries(def.properties)) {
                                    const col = colDef as { type?: string; format?: string };
                                    columns.push({
                                        name: colName,
                                        type: col.format || col.type || 'unknown',
                                        isNullable: true,
                                        isPrimaryKey: false, // OpenAPI doesn't easily expose PK info
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
        if (!this.client) return { data: [], error: 'Client not initialized' };

        try {
            let query = this.client.from(tableName).select(options.select || '*');

            if (options.order) {
                query = query.order(options.order.column, { ascending: options.order.ascending });
            }

            if (options.limit) {
                const start = options.offset || 0;
                const end = start + options.limit - 1;
                query = query.range(start, end);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { data: data as T[] };
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
     */
    subscribeToTable(
        tableName: string,
        eventType: RealtimeEventType,
        callback: RealtimeCallback
    ): { unsubscribe: () => void } {
        if (!this.client) {
            console.warn("Realtime subscription failed: Client not initialized");
            return { unsubscribe: () => { } };
        }

        const channel = this.client
            .channel(`public:${tableName}`)
            .on(
                'postgres_changes',
                { event: eventType as any, schema: 'public', table: tableName },
                (payload: any) => {
                    callback(payload);
                }
            )
            .subscribe();

        console.log(`[Supabase] Subscribed to ${tableName} for ${eventType}`);

        return {
            unsubscribe: () => {
                this.client?.removeChannel(channel);
                console.log(`[Supabase] Unsubscribed from ${tableName}`);
            },
        };
    }


    /**
     * Get table schema (columns)
     * Tries OpenAPI first, falls back to inference
     */
    async getTableSchema(tableName: string): Promise<SupabaseColumn[]> {
        // Strategy 1: OpenAPI via listTables (Precise types)
        const tables = await this.listTables();
        const table = tables.find((t) => t.name === tableName);
        if (table?.columns && table.columns.length > 0) {
            return table.columns;
        }

        // Strategy 2: Infer from data (Fallback)
        if (!this.client) return [];
        try {
            const { data } = await this.client.from(tableName).select('*').limit(1);
            if (data && data.length > 0) {
                const row = data[0];
                return Object.keys(row).map(key => ({
                    name: key,
                    type: typeof row[key],
                    isNullable: true,
                    isPrimaryKey: false,
                }));
            }
        } catch (e) {
            console.warn(`Failed to infer schema for ${tableName}`, e);
        }
        return [];
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const supabaseClient = new SupabaseClient();

// Named export for use in components
export { SupabaseClient as SupabaseClientClass };
