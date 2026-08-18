interface Guidance {
  prefix: string;
  guidance: string;
}

const PAGE_GUIDANCE: Guidance[] = [
  {
    prefix: '/rules/new',
    guidance:
      'This is the visual rule designer. Help the operator choose a source, projections, filters, windows, grouping, and sinks; explain the generated SQL and JSON. Treat Validation as a dry check and Create rule as an explicit human decision.',
  },
  {
    prefix: '/query-designer',
    guidance: 'This legacy URL redirects to the visual rule designer under /rules/new.',
  },
  {
    prefix: '/rules/playground',
    guidance:
      'This is the rule playground. Explain test inputs and outputs and distinguish testing from creating or starting a production rule.',
  },
  {
    prefix: '/rules',
    guidance:
      'Help inspect, create, edit, validate, start, stop, restart, trace, duplicate, tag, and understand eKuiper rules. Explain SQL, graph rules, actions, status, metrics, topology, and state reset carefully.',
  },
  {
    prefix: '/streams',
    guidance:
      'Help define and inspect eKuiper stream SQL, fields, source type, data source, format, schema, timestamp behavior, and connector options. Point out that edits can affect dependent rules.',
  },
  {
    prefix: '/tables',
    guidance:
      'Help define scan or lookup tables, fields, source type, data source, format, key, and connector options. Explain how rules join or look up table data.',
  },
  {
    prefix: '/connections',
    guidance:
      'Help configure shared eKuiper connections and connector metadata. Never ask the operator to paste passwords, tokens, or authorization values into chat.',
  },
  {
    prefix: '/schemas',
    guidance:
      'Help manage protobuf and custom schemas, content or files, versions, shared libraries, uploads, and compatibility with stream or table decoding.',
  },
  {
    prefix: '/uploads',
    guidance:
      'Help upload and remove files used by eKuiper resources. Explain accepted input methods and warn before removing a referenced file.',
  },
  {
    prefix: '/plugins',
    guidance:
      'Help inspect, install, update, register, and remove native or portable eKuiper plugins. Explain plugin type, package URI, function symbols, lifecycle, and restart impact.',
  },
  {
    prefix: '/functions',
    guidance:
      'Help inspect built-in, native, service, and JavaScript functions. Explain signatures, aggregation behavior, script definitions, and plugin ownership.',
  },
  {
    prefix: '/services',
    guidance:
      'Help register and inspect external services and their functions, including service package URI, interfaces, address, method, and function mappings.',
  },
  {
    prefix: '/data/import',
    guidance:
      'Help import eKuiper configuration from content or file, explain stop and partial options, and advise reviewing conflicts before import.',
  },
  {
    prefix: '/data/export',
    guidance:
      'Help export eKuiper configuration and explain what is included. Distinguish this from a Manager database backup.',
  },
  {
    prefix: '/metadata',
    guidance:
      'Help interpret eKuiper source, sink, connection, function, and operator metadata and dynamic connector forms.',
  },
  {
    prefix: '/nodes',
    guidance:
      'Help add, probe, select, update, and remove managed eKuiper nodes. Removing a node from Manager does not delete or stop eKuiper itself.',
  },
  {
    prefix: '/users',
    guidance:
      'Help an owner add a basic user, reset a password, or delete a user. Never request or repeat passwords. Reset and delete revoke sessions.',
  },
  {
    prefix: '/settings',
    guidance:
      'Explain Manager settings, selected eKuiper node context, and self-hosted deployment configuration without inventing unavailable controls.',
  },
  {
    prefix: '/system',
    guidance: 'Help interpret eKuiper version, OS, architecture, uptime, CPU, memory, and runtime health.',
  },
  {
    prefix: '/api-docs',
    guidance:
      'Help navigate the bundled eKuiper 2.4.1 OpenAPI reference. Keep management-server routes distinct from optional or separate-port endpoints.',
  },
  {
    prefix: '/dashboard',
    guidance:
      'Summarize the selected node, resource counts, runtime health, and sensible next operational step. Do not infer that a missing metric means failure.',
  },
];

export function assistantPageGuidance(path: string): string {
  return (
    PAGE_GUIDANCE.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))?.guidance ??
    'Explain the visible eKuiper Manager page and guide the operator through its available controls without inventing features.'
  );
}

const PAGE_SUGGESTIONS: Array<{ prefix: string; prompts: string[] }> = [
  {
    prefix: '/rules/new',
    prompts: ['Review the generated SQL and JSON', 'What should I validate before creating?', 'Explain the selected sink options'],
  },
  {
    prefix: '/rules',
    prompts: ['Explain the current rule status', 'What could this rule affect?', 'Suggest a safe troubleshooting sequence'],
  },
  {
    prefix: '/streams',
    prompts: ['Review this stream definition', 'Explain these connector options', 'Which rules may depend on this stream?'],
  },
  {
    prefix: '/tables',
    prompts: ['Review this table definition', 'Should this be scan or lookup?', 'Explain the key and data-source options'],
  },
  {
    prefix: '/connections',
    prompts: ['Explain the visible connection fields', 'How can I test this safely?', 'Which resources can share this connection?'],
  },
  {
    prefix: '/schemas',
    prompts: ['Which schema type should I use?', 'Review the visible schema settings', 'How does version replacement work?'],
  },
  {
    prefix: '/plugins',
    prompts: ['Explain this plugin type', 'What should I check before installing?', 'What could removal affect?'],
  },
  {
    prefix: '/functions',
    prompts: ['Explain this function signature', 'Is this function aggregate?', 'Where can this function be used?'],
  },
  {
    prefix: '/services',
    prompts: ['Explain the service mapping', 'Review the visible interface fields', 'How can I verify this service?'],
  },
  {
    prefix: '/data/import',
    prompts: ['What will this import change?', 'Explain stop and partial options', 'Give me a safe import checklist'],
  },
  {
    prefix: '/data/export',
    prompts: ['What does this export include?', 'How should I store this backup?', 'What is not included here?'],
  },
  {
    prefix: '/uploads',
    prompts: ['What can use this file?', 'Review the upload requirements', 'What should I check before deleting?'],
  },
  {
    prefix: '/nodes',
    prompts: ['Explain this node status', 'How should I test this node?', 'What changes when I select this node?'],
  },
  {
    prefix: '/users',
    prompts: ['Explain the basic user lifecycle', 'What does password reset revoke?', 'What should I check before deleting a user?'],
  },
  {
    prefix: '/dashboard',
    prompts: ['Summarize this node', 'What should I investigate next?', 'Explain the rule status counts'],
  },
];

export function assistantPageSuggestions(path: string): string[] {
  return (
    PAGE_SUGGESTIONS.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))?.prompts ?? [
      'Explain the visible options',
      'What should I check next?',
      'Give me a safe step-by-step approach',
    ]
  );
}
