/**
 * EMQX REST API Type Definitions
 * Based on EMQX v5 REST API documentation
 */

// =============================================================================
// Authentication Types
// =============================================================================

export interface EMQXLoginRequest {
    username: string;
    password: string;
}

export interface EMQXLoginResponse {
    token: string;
    license?: {
        edition: string;
    };
    version?: string;
}

export interface EMQXCredentials {
    serverUrl: string;
    username: string;
    password: string;
    token?: string;
    tokenExpiry?: number;
}

// =============================================================================
// Client Types
// =============================================================================

export interface EMQXClientInfo {
    clientid: string;
    username?: string;
    connected: boolean;
    connected_at?: string;
    disconnected_at?: string;
    ip_address?: string;
    port?: number;
    keepalive?: number;
    proto_name?: string;
    proto_ver?: number;
    clean_start?: boolean;
    expiry_interval?: number;
    node?: string;
    is_bridge?: boolean;
    zone?: string;
    mountpoint?: string;
    listener?: string;
    recv_oct?: number;
    recv_cnt?: number;
    recv_pkt?: number;
    recv_msg?: number;
    send_oct?: number;
    send_cnt?: number;
    send_pkt?: number;
    send_msg?: number;
    mailbox_len?: number;
    heap_size?: number;
    reductions?: number;
    awaiting_rel_cnt?: number;
    inflight_cnt?: number;
    subscriptions_cnt?: number;
    created_at?: string;
}

export interface EMQXClientListResponse {
    data: EMQXClientInfo[];
    meta: {
        count?: number;
        cursor?: string;
        hasnext?: boolean;
        limit?: number;
        page?: number;
    };
}

// =============================================================================
// Subscription Types
// =============================================================================

export interface EMQXSubscription {
    clientid: string;
    node?: string;
    topic: string;
    qos: number;
    nl?: number;  // No Local
    rap?: number; // Retain as Published
    rh?: number;  // Retain Handling
}

export interface EMQXSubscriptionListResponse {
    data: EMQXSubscription[];
    meta: {
        count?: number;
        cursor?: string;
        hasnext?: boolean;
        limit?: number;
        page?: number;
    };
}

// =============================================================================
// Topic Types
// =============================================================================

export interface EMQXTopic {
    topic: string;
    subscriberCount: number;
    lastSeen?: string;
}

export interface EMQXTopicMetrics {
    topic: string;
    messageInRate?: number;
    messageOutRate?: number;
}

// =============================================================================
// Message Types (for live preview)
// =============================================================================

export interface EMQXMessage {
    topic: string;
    payload: string | Record<string, unknown>;
    qos: number;
    retain: boolean;
    timestamp: number;
    clientId?: string;
}

// =============================================================================
// Connection Test Result
// =============================================================================

export interface EMQXConnectionTestResult {
    success: boolean;
    message: string;
    version?: string;
    edition?: string;
}

// =============================================================================
// Storage Keys
// =============================================================================

export const EMQX_STORAGE_KEYS = {
    CREDENTIALS: 'emqx_credentials',
    TOKEN: 'emqx_token',
    TOKEN_EXPIRY: 'emqx_token_expiry',
} as const;
