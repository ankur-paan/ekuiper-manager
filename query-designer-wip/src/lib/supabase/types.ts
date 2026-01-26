/**
 * Supabase Client Type Definitions
 * For historical data access in Query Designer
 */

// =============================================================================
// Configuration Types
// =============================================================================

export interface SupabaseCredentials {
    projectUrl: string;
    anonKey: string;
}

export interface SupabaseConnectionTestResult {
    success: boolean;
    message: string;
    tables?: string[];
}

// =============================================================================
// Table Types
// =============================================================================

export interface SupabaseColumn {
    name: string;
    type: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    defaultValue?: string;
}

export interface SupabaseTable {
    name: string;
    schema: string;
    rowCount?: number;
    columns?: SupabaseColumn[];
}

// =============================================================================
// Query Types
// =============================================================================

export interface SupabaseQueryOptions {
    select?: string;
    filter?: Record<string, unknown>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
}

export interface SupabaseQueryResult<T = Record<string, unknown>> {
    data: T[];
    count?: number;
    error?: string;
}

// =============================================================================
// Realtime Types
// =============================================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = Record<string, unknown>> {
    eventType: RealtimeEventType;
    table: string;
    schema: string;
    new: T | null;
    old: T | null;
    timestamp: string;
}

export type RealtimeCallback<T = Record<string, unknown>> = (
    payload: RealtimePayload<T>
) => void;

// =============================================================================
// Storage Keys
// =============================================================================

export const SUPABASE_STORAGE_KEY = 'supabase_credentials';
