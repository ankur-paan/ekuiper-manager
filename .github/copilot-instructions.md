# eKuiper Playground - AI Coding Agent Instructions

## Project Overview
A **Next.js 14** (App Router) web IDE and management interface for [LF Edge eKuiper](https://ekuiper.org/) - an IoT stream processing engine. This is an open-source alternative to EMQ's proprietary eKuiper Manager.

> ⚠️ **CRITICAL: This application is exclusively for eKuiper.** All features, APIs, and functionality must align with official eKuiper capabilities.

## eKuiper API Documentation Reference

**Before implementing any eKuiper API interaction, you MUST verify it against the official documentation in `docs/ekupier/`.**

### Documentation Structure
- [docs/ekupier/emqx_kuiper_full.md](../docs/ekupier/emqx_kuiper_full.md) - Consolidated eKuiper documentation
- `docs/ekupier/emqx_docs/*.md` - Individual topic documentation files

### Key Documentation Topics
| Topic | File | Use For |
|-------|------|---------|
| EdgeX Integration | `edgex_edgex_rule_engine_tutorial.md` | EdgeX source/sink configuration |
| Meta Functions | `edgex_edgex_meta.md` | `meta()` function for EdgeX metadata extraction |
| External Functions | `extension_external_external_func.md` | gRPC/REST/msgpack-rpc service integration |
| Plugin Development | `extension_native_develop_*.md` | Source, Sink, Function plugin APIs |
| REST API | `operation_restapi_*.md` | eKuiper REST API endpoints |
| CLI Commands | `operation_cli_*.md` | CLI operations reference |

### API Validation Rules
1. **Only use official eKuiper APIs** - Do not invent or assume API endpoints
2. **Check docs before adding new API calls** - Verify endpoint exists in documentation
3. **Match data structures exactly** - Use types from `src/lib/ekuiper/types.ts` that mirror official API responses
4. **Port 9081 is default** - eKuiper REST API default port (59720 in EdgeX integration)

### Official eKuiper REST API Reference

> ⚠️ **You MUST only use these APIs. Do NOT invent or assume any other endpoints.**

#### System APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get system info (version, os, upTimeSeconds) |
| `GET` | `/ping` | Health check endpoint |

#### Streams APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/streams` | Create a stream |
| `GET` | `/streams` | List all streams |
| `GET` | `/streams/{id}` | Describe a stream |
| `PUT` | `/streams/{id}` | Update a stream |
| `DELETE` | `/streams/{id}` | Drop a stream |

#### Tables APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tables` | Create a table |
| `GET` | `/tables` | List all tables |
| `GET` | `/tables/{id}` | Describe a table |
| `PUT` | `/tables/{id}` | Update a table |
| `DELETE` | `/tables/{id}` | Drop a table |

#### Rules APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/rules` | Create a rule |
| `GET` | `/rules` | List all rules |
| `GET` | `/rules/{id}` | Describe a rule |
| `PUT` | `/rules/{id}` | Update a rule |
| `DELETE` | `/rules/{id}` | Drop a rule |
| `POST` | `/rules/{id}/start` | Start a rule |
| `POST` | `/rules/{id}/stop` | Stop a rule |
| `POST` | `/rules/{id}/restart` | Restart a rule |
| `GET` | `/rules/{id}/status` | Get rule status/metrics |
| `GET` | `/rules/{id}/topo` | Get rule topology |

#### Plugins APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/plugins/sources` | Create a source plugin |
| `POST` | `/plugins/sinks` | Create a sink plugin |
| `POST` | `/plugins/functions` | Create a function plugin |
| `POST` | `/plugins/portables` | Create a portable plugin |
| `GET` | `/plugins/sources` | List source plugins |
| `GET` | `/plugins/sinks` | List sink plugins |
| `GET` | `/plugins/functions` | List function plugins |
| `GET` | `/plugins/portables` | List portable plugins |
| `GET` | `/plugins/sources/{name}` | Describe a source plugin |
| `GET` | `/plugins/sinks/{name}` | Describe a sink plugin |
| `GET` | `/plugins/functions/{name}` | Describe a function plugin |
| `GET` | `/plugins/portables/{name}` | Describe a portable plugin |
| `DELETE` | `/plugins/sources/{name}` | Drop a source plugin |
| `DELETE` | `/plugins/sinks/{name}` | Drop a sink plugin |
| `DELETE` | `/plugins/functions/{name}` | Drop a function plugin |
| `DELETE` | `/plugins/portables/{name}` | Drop a portable plugin |
| `DELETE` | `/plugins/sources/{name}?stop=1` | Drop plugin and stop eKuiper |
| `GET` | `/plugins/udfs` | List all user-defined functions |
| `GET` | `/plugins/udfs/{name}` | Describe a UDF |
| `POST` | `/plugins/functions/{plugin_name}/register` | Register functions for a plugin |
| `GET` | `/plugins/sources/prebuild` | Get available prebuild source plugins |
| `GET` | `/plugins/sinks/prebuild` | Get available prebuild sink plugins |
| `GET` | `/plugins/functions/prebuild` | Get available prebuild function plugins |

#### Services APIs (External Services)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/services` | Register an external service |
| `GET` | `/services` | List all external services |
| `GET` | `/services/{name}` | Describe an external service |
| `PUT` | `/services/{name}` | Update an external service |
| `DELETE` | `/services/{name}` | Delete an external service |
| `GET` | `/services/functions` | List all external functions |
| `GET` | `/services/functions/{name}` | Describe an external function |

## Architecture

### Stack
- **Framework**: Next.js 14 with App Router (`src/app/`)
- **State Management**: Zustand stores in `src/stores/` (server connections, pipelines, persistence)
- **UI Components**: Radix UI primitives in `src/components/ui/` - always import from `@/components/ui/*`
- **Data Fetching**: TanStack React Query (configured in `src/components/providers.tsx`)
- **Styling**: Tailwind CSS with custom `sota-*` theme colors

### Key Architectural Patterns

**API Proxy Pattern**: The frontend never calls eKuiper directly. All requests proxy through Next.js API routes:
```
Frontend → /api/ekuiper/[...path] → eKuiper Server (configurable via X-EKuiper-URL header)
```
See [src/app/api/ekuiper/[...path]/route.ts](src/app/api/ekuiper/%5B...path%5D/route.ts) for the proxy implementation.

**Client Hierarchy**:
- `EKuiperClient` ([src/lib/ekuiper/client.ts](src/lib/ekuiper/client.ts)) - Base REST API wrapper
- `EKuiperManagerClient` extends `EKuiperClient` - Extended operations for manager features

**Component Organization**:
```
src/components/
├── ui/               # Radix primitives (Button, Dialog, Tabs, etc.)
├── editor/           # Monaco editors (sql-editor, json-editor, python-editor)
├── pipeline/         # React Flow visual pipeline builder
├── management/       # Streams, Rules, Tables CRUD
├── manager/          # Admin features (connections, configs, logs)
├── plugins/          # Plugin development tools
├── visualization/    # Live data, performance profiling, dependency graphs
└── common/           # Shared utilities (connection-tester, help-components)
```

## Development Commands
```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript validation
```

**Requires**: eKuiper server at `http://localhost:9081` (or configure via `EKUIPER_URL` env)

## Critical Conventions

### Imports
- Use `@/*` path aliases (maps to `./src/*`)
- UI components: `import { Button } from "@/components/ui/button"`
- eKuiper types/client: `import { EKuiperClient, Rule, Stream } from "@/lib/ekuiper"`

### State Management
- **Server connections**: `useServerStore` from `@/stores/server-store`
- **Pipeline state**: `usePipelineStore` from `@/stores/pipeline-store` (includes undo/redo)
- Get active eKuiper client: `const client = useServerStore().getClient()`

### Component Patterns
1. **All components are "use client"** - This is a client-heavy application
2. **Feature components** compose UI primitives from `@/components/ui/`
3. **Editors** wrap Monaco Editor with domain-specific language support

### eKuiper SQL Language Support
Custom Monaco language definition in [src/lib/ekuiper/language.ts](src/lib/ekuiper/language.ts):
- `EKUIPER_KEYWORDS` - DDL/DML keywords
- `ALL_EKUIPER_FUNCTIONS` - 50+ built-in functions with signatures
- `EKUIPER_DATA_TYPES` - BIGINT, FLOAT, STRING, STRUCT, etc.

### Visual Pipeline Builder
Uses React Flow library. Key files:
- [src/components/pipeline/canvas.tsx](src/components/pipeline/canvas.tsx) - Main canvas
- [src/components/pipeline/nodes.tsx](src/components/pipeline/nodes.tsx) - Custom node types (Source, Rule, Sink)
- [src/stores/pipeline-store.ts](src/stores/pipeline-store.ts) - Pipeline state with undo/redo history

### eKuiper API Types
All types in [src/lib/ekuiper/types.ts](src/lib/ekuiper/types.ts):
- `Stream`, `Rule`, `Table` - Core resources
- `SinkConfig` - Sink configuration (MQTT, REST, File, etc.)
- `RuleMetrics`, `RuleTopology` - Runtime data

## When Adding Features
1. Check [FEATURE_IMPLEMENTATION_PLAN.md](FEATURE_IMPLEMENTATION_PLAN.md) for existing feature status
2. New UI → create in appropriate `src/components/` subdirectory
3. New API types → add to `src/lib/ekuiper/types.ts`
4. New API endpoints → extend `EKuiperClient` or `EKuiperManagerClient`
5. Register new views in [src/app/page.tsx](src/app/page.tsx) navigation

## External Dependencies Context
- **React Flow** - Visual pipeline builder (`reactflow`)
- **Monaco Editor** - Code editors (`@monaco-editor/react`)
- **Recharts** - Metrics visualization
- **MQTT.js** - MQTT simulator connectivity
- **idb** - IndexedDB for client-side persistence

## Common eKuiper Concepts (from docs)

Understanding these domain concepts is essential:

| Concept | Description | Docs Reference |
|---------|-------------|----------------|
| **Stream** | Data source definition (MQTT, EdgeX, HTTP, memory) | `operation_restapi_streams.md` |
| **Rule** | SQL query + actions (sinks) for processing | `rules_overview.md` |
| **Table** | Lookup table for JOIN operations | `operation_restapi_tables.md` |
| **Sink** | Output destination (MQTT, REST, file, EdgeX) | `rules_sinks_*.md` |
| **Source** | Input connector type | `extension_native_sources_*.md` |
| **Plugin** | Extensible source/sink/function | `extension_native_develop_*.md` |

### eKuiper SQL Specifics
- Uses `meta()` function for metadata extraction (see `edgex_edgex_meta.md`)
- Window functions: `TUMBLING`, `HOPPING`, `SLIDING`, `SESSION`
- Supports Go templates in `dataTemplate` for sink output formatting
