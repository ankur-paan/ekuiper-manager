
/**
 * Shared logic for eKuiper Node Visualization
 * Ensures consistency between Topology Graph and Metrics Status screens.
 */

// Official Op-Codes to Friendly Names
const OP_TYPE_MAP: Record<string, string> = {
    'filter': 'Filter',
    'project': 'Transform',
    'window': 'Window',
    'join': 'Join',
    'agg': 'Aggregate',
    'order': 'Sort',
    'func': 'Function',
    'mqtt': 'MQTT',
    'http': 'HTTP',
    'rest': 'REST API',
    'sql': 'SQL',
    'log': 'Log',
    'nop': 'No-Op'
};

/**
 * Parses a raw eKuiper node ID (e.g. "op_filter_0", "source_sdm120_stream")
 * into a clean, human-readable display name and type info.
 */
export function parseNodeId(rawId: string) {
    let type: 'source' | 'operator' | 'sink' = 'operator';
    let label = rawId;
    let iconKey = 'box';

    // 1. Determine Type & Strip Prefix
    if (rawId.startsWith('source_')) {
        type = 'source';
        label = rawId.replace('source_', '');
        iconKey = 'wifi';
    } else if (rawId.startsWith('sink_')) {
        type = 'sink';
        label = rawId.replace('sink_', '');
        iconKey = 'server';
    } else if (rawId.startsWith('op_')) {
        type = 'operator';
        label = rawId.replace('op_', '');
    }

    // 2. Strip Auto-generated Suffixes (_0, _1)
    // SOTA Logic: Remove trailing numbers, but keep meaningful numbers if part of name
    // e.g. "my_stream_2" -> "my stream"
    const parts = label.split('_');
    const meaningfulParts = parts.filter(p => isNaN(Number(p)));

    // 3. Title Case & Special Keywords
    const cleanName = meaningfulParts.map(p => {
        // Check for known keywords
        const lower = p.toLowerCase();
        if (OP_TYPE_MAP[lower]) return OP_TYPE_MAP[lower];
        // Capitalize
        return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');

    // 4. Icon Heuristics (if still generic)
    const lowerLabel = label.toLowerCase();
    if (type === 'operator') {
        if (lowerLabel.includes('filter') || lowerLabel.includes('where')) iconKey = 'filter';
        else if (lowerLabel.includes('project') || lowerLabel.includes('select')) iconKey = 'file-code';
        else if (lowerLabel.includes('window')) iconKey = 'clock';
        else if (lowerLabel.includes('join') || lowerLabel.includes('lookup')) iconKey = 'git-merge';
        else if (lowerLabel.includes('agg') || lowerLabel.includes('group')) iconKey = 'calculator';
        else if (lowerLabel.includes('sort')) iconKey = 'arrow-down-up';
    }

    return {
        rawId,
        type,
        label: cleanName || label, // Fallback if empty
        iconKey,
        isSystem: rawId.startsWith('op_')
    };
}
