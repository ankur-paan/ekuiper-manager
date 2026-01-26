
// =============================================================================
// eKuiper Wizard State Definitions (VQM)
// =============================================================================

export interface WizardState {
    // Step Tracking
    currentStep: number; // 0=Source, 1=Filter, 2=Transform, 3=Sink
    isStepValid: boolean;

    // Configuration Data
    ruleId: string;
    sources: SourceConfig[];
    joins: JoinConfig[];
    filters: FilterConfig[];
    aggregation: AggregateConfig;
    selections: SelectionConfig[];
    sinks: SinkConfig[]; // Replaced 'sink' with array for multi-sink support
    tourFocus: string | null;
    sourceSchemas: Record<string, any>; // resourceName -> schema mapping
    sharedConfigs: {
        mqtt: Record<string, any>;
    };
    testStatus: 'idle' | 'running' | 'success' | 'failed';
    testOutput: any[];
}

// -----------------------------------------------------------------------------
// Step 1: Sources & Joins
// -----------------------------------------------------------------------------
export interface SourceConfig {
    id: string;
    resourceName: string;
    resourceType: "stream" | "table" | "topic";
    alias?: string;
}

export interface JoinConfig {
    id: string;
    joinType: "LEFT" | "RIGHT" | "INNER" | "FULL" | "CROSS";
    targetSourceId: string; // ID of one of the defined sources (not the main/first one)
    conditions: JoinCondition[];
}

export interface JoinCondition {
    leftField: string; // e.g. "s1.id"
    operator: "=" | "!=" | ">" | "<";
    rightField: string; // e.g. "s2.id"
}

// -----------------------------------------------------------------------------
// Step 2: Filters
// -----------------------------------------------------------------------------
export interface FilterConfig {
    id: string;
    logic: "AND" | "OR"; // Logic connecting this group to the previous one
    expressions: FilterExpression[];
}

export interface FilterExpression {
    id: string;
    field: string;
    operator: string;
    value: string;
    castType?: "auto" | "number" | "string";
}

// -----------------------------------------------------------------------------
// Step 3: Transformations (Select & Aggregate)
// -----------------------------------------------------------------------------
export interface SelectionConfig {
    field: string;
    alias?: string;
    function?: string; // avg, max, etc.
}

export interface AggregateConfig {
    enabled: boolean;
    windowType?: "tumbling" | "hopping" | "sliding" | "session" | "count";
    windowUnit?: "ms" | "s" | "m" | "h" | "d";
    windowLength?: number;
    windowInterval?: number; // For hopping
    groupByFields: string[];
}

// -----------------------------------------------------------------------------
// Step 4: Sink
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Step 4: Sink (Multi-Sink Support)
// -----------------------------------------------------------------------------
export interface SinkConfig {
    id: string; // Added ID for array management
    targetType: "mqtt" | "rest" | "nop" | "log" | "memory";
    properties: Record<string, any>;
}


