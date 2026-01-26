
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
    WizardState,
    SourceConfig,
    JoinConfig,
    FilterConfig,
    AggregateConfig,
    SinkConfig,
    SelectionConfig
} from '@/lib/wizard/types';

interface WizardActions {
    // Navigation
    setStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    resetWizard: () => void;

    // Step 1: Sources
    addSource: (source: Omit<SourceConfig, 'id'>) => void;
    removeSource: (id: string) => void;
    updateSource: (id: string, updates: Partial<SourceConfig>) => void;

    // Step 1: Joins
    addJoin: (join: Omit<JoinConfig, 'id'>) => void;
    removeJoin: (id: string) => void;
    updateJoin: (id: string, updates: Partial<JoinConfig>) => void;

    // Step 2: Filters
    addFilter: (filter: Omit<FilterConfig, 'id'>) => void;
    removeFilter: (id: string) => void;
    updateFilter: (id: string, updates: Partial<FilterConfig>) => void;

    // Step 3: Transform
    setSelections: (selections: SelectionConfig[]) => void;
    updateAggregation: (updates: Partial<AggregateConfig>) => void;

    // Step 4: Sinks (Multi-Sink Support)
    addSink: (sink: Omit<SinkConfig, 'id'>) => void;
    removeSink: (id: string) => void;
    updateSink: (id: string, updates: Partial<SinkConfig>) => void;

    // Legacy support removal
    // setSink: (sink: SinkConfig) => void; 

    // General
    setRuleId: (id: string) => void;
    setTourFocus: (focus: string | null) => void;
    setSourceSchema: (resourceName: string, schema: any) => void;
    setSharedConfigs: (type: 'mqtt', configs: Record<string, any>) => void;
    setTestStatus: (status: 'idle' | 'running' | 'success' | 'failed') => void;
    setTestOutput: (output: any[]) => void;
}

const INITIAL_STATE: Omit<WizardState, keyof WizardActions> = {
    currentStep: 0,
    isStepValid: true,
    ruleId: "",
    sources: [],
    joins: [],
    filters: [],
    aggregation: { enabled: false, groupByFields: [] },
    selections: [], // Empty implies "SELECT *" in our logic
    sinks: [], // Initialize empty
    tourFocus: null,
    sourceSchemas: {},
    sharedConfigs: { mqtt: {} },
    testStatus: 'idle',
    testOutput: []
};

export const useQueryWizardStore = create<WizardState & WizardActions>((set, get) => ({
    ...INITIAL_STATE,

    // Navigation
    setStep: (step) => set({ currentStep: step }),
    nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })), // Max 5 steps (0-4)
    prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
    resetWizard: () => set(INITIAL_STATE),

    // Sources
    addSource: (source) => set((state) => ({
        sources: [...state.sources, { ...source, id: uuidv4() }]
    })),
    removeSource: (id) => set((state) => ({
        sources: state.sources.filter(s => s.id !== id)
    })),
    updateSource: (id, updates) => set((state) => ({
        sources: state.sources.map(s => s.id === id ? { ...s, ...updates } : s)
    })),
    setSourceSchema: (resourceName, schema) => set((state) => ({
        sourceSchemas: { ...state.sourceSchemas, [resourceName]: schema }
    })),
    setSharedConfigs: (type, configs) => set((state) => ({
        sharedConfigs: { ...state.sharedConfigs, [type]: configs }
    })),

    // Joins
    addJoin: (join) => set((state) => ({
        joins: [...state.joins, { ...join, id: uuidv4() }]
    })),
    removeJoin: (id) => set((state) => ({
        joins: state.joins.filter(j => j.id !== id)
    })),
    updateJoin: (id, updates) => set((state) => ({
        joins: state.joins.map(j => j.id === id ? { ...j, ...updates } : j)
    })),

    // Filters
    addFilter: (filter) => set((state) => ({
        filters: [...state.filters, { ...filter, id: uuidv4() }]
    })),
    removeFilter: (id) => set((state) => ({
        filters: state.filters.filter(f => f.id !== id)
    })),
    updateFilter: (id, updates) => set((state) => ({
        filters: state.filters.map(f => f.id === id ? { ...f, ...updates } : f)
    })),

    // Transform
    setSelections: (selections) => set({ selections }),
    updateAggregation: (updates) => set((state) => ({
        aggregation: { ...state.aggregation, ...updates }
    })),

    // Sinks
    addSink: (sink) => set((state) => ({
        sinks: [...state.sinks, { ...sink, id: uuidv4() }]
    })),
    removeSink: (id) => set((state) => ({
        sinks: state.sinks.filter(s => s.id !== id)
    })),
    updateSink: (id, updates) => set((state) => ({
        sinks: state.sinks.map(s => s.id === id ? { ...s, ...updates } : s)
    })),

    // General
    setRuleId: (id) => set({ ruleId: id }),
    setTourFocus: (focus) => set({ tourFocus: focus }),

    // Testing
    setTestStatus: (status) => set({ testStatus: status }),
    setTestOutput: (output) => set({ testOutput: output }),
}));
