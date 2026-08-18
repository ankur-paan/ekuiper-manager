# Rule designer: interaction and fidelity contract

Status: implemented and running locally against eKuiper 2.4.1. This document is the product and engineering contract for the designer; it is intentionally more precise than a screenshot walkthrough.

## 1. Purpose and entry points

The designer turns an eKuiper rule definition into a guided, inspectable workflow without hiding the underlying SQL or JSON.

- **Rules → Designer** and `/rules/new` create a rule.
- `/rules/{id}/edit` loads the same designer with the existing definition.
- `/query-designer` redirects to `/rules/new` for old bookmarks.
- `/rules/playground` also redirects to the designer. The removed playground simulated a WebSocket and was not an authoritative eKuiper rule test.
- **Rules → row menu → Duplicate** creates a stopped copy, then opens it in the designer.

The default is safe: a new or duplicated rule is stopped unless the operator explicitly enables **Start after creation**.

## 2. ESPHome interaction model adapted to eKuiper

The current ESPHome Device Builder uses a searchable component catalog, structured fields, visual/split/raw layouts, live generated YAML, backend validation, masked sensitive values, and an explicit raw-editor fallback for shapes the visual editor cannot preserve. Those are the useful design ideas adopted here.

The eKuiper adaptation is deliberately not a visual clone:

- The left side composes a query, outputs, and runtime behavior; the right side shows the exact rule JSON and generated SQL.
- Actual streams and tables from the selected node replace ESPHome's board/component catalog.
- Installed sink metadata is merged with the Manager's typed built-in editors.
- eKuiper JSON and SQL replace YAML because those are the engine's native rule formats.
- Raw definition editing is an escape hatch, not a separate competing editor.
- A fake live-data preview is not shown. Real preview depends on the separately configured rule-test SSE transport and remains explicit work.

Primary ESPHome references used for the interaction audit:

- [ESPHome Device Builder frontend](https://github.com/esphome/device-builder-frontend)
- [Device editor split layout](https://github.com/esphome/device-builder-frontend/blob/main/src/components/device/device-editor.ts)
- [Visual/YAML layout controls](https://github.com/esphome/device-builder-frontend/blob/main/src/components/device/device-editor-toolbar.ts)
- [Official Device Builder API and editor preferences](https://github.com/esphome/device-builder/blob/main/docs/API.md)

## 3. Complete flow and controls

### Global header

- **Back** returns to the rule or rules list.
- **Validate with eKuiper** submits the generated definition to official `POST /rules/validate` on the selected registered node.
- **Create rule** or **Save changes** validates again and then uses official create/update.
- The selected node name is always shown in the page description.

### Step 1 — Source & query

Identity:

- **Rule ID** accepts letters, numbers, hyphen, and underscore. It is immutable during edit.

Query mode:

- **Visual** generates a supported SQL shape from structured controls.
- **SQL** is the exact free-form editor and supports any eKuiper SQL the engine accepts.

Visual controls:

- **Find a stream or table** filters the selected node's live resource catalog.
- Resource cards distinguish **Stream** from **Table** and show the current selection.
- **Source name** accepts a manual name when the desired source is not in the catalog.
- **Select fields** maps to `SELECT`; it accepts expressions and aliases, not only column names.
- **Filter (WHERE)** maps to `WHERE`.
- **Group by** maps to `GROUP BY`, including eKuiper window expressions.
- **Having** maps to `HAVING`.
- **Order by** maps to `ORDER BY`.
- **Limit** maps to `LIMIT`.

Edit behavior:

- A simple existing SQL definition is decomposed into the visual fields.
- SQL outside the supported decomposition shape opens in SQL mode and is preserved verbatim.
- A graph rule opens with a clear graph-rule banner and remains in raw-definition mode; the designer does not silently convert it to SQL.

### Step 2 — Outputs

Sink catalog:

- **Find a sink** filters the union of sink types reported by `GET /metadata/sinks`, built-in typed editors, and types already present in the rule.
- Each catalog card identifies whether the node reported the sink or the Manager only has a built-in editor for it.
- Selecting a card appends an output. There is no one-output restriction.

Output cards:

- Sink type is changeable.
- Outputs can move up/down, preserving eKuiper action order.
- Outputs can be removed; validation refuses a rule with none.
- Metadata properties are merged by key with known definitions. Metadata supplies installed-build fields, labels, required flags, enum values, and hints; known definitions supply safe input types and useful placeholders.

Typed built-in coverage:

- **Log** and **No-op**
- **MQTT**: shared connection, broker, topic, client ID, username/password, QoS, retained, TLS controls, certificate/key paths
- **HTTP/REST**: URL, method, body type, headers JSON, timeout, TLS verification
- **Memory**: topic and key field
- **File**: path, file type, delimiter, header
- **SQL**: database URL, table, string-array fields, `sendSingle`
- **EdgeX**: connection, protocol, host/port, topics, content/message type, metadata, profile/device/source names
- Common sink values include `sendSingle`, `omitIfEmpty`, and `dataTemplate`.

Fidelity rules:

- Numbers remain numbers; booleans remain booleans; lists remain arrays.
- Nested objects, unrecognised future properties, and action-level outer properties survive load/edit/save.
- **Advanced JSON** edits the complete sink config. It is disabled while sensitive values are masked so mask placeholders can never overwrite credentials.
- Secret-like fields render as password controls and are masked in generated JSON by default.

### Step 3 — Runtime

Structured options:

- **Use event time** → `isEventTime`
- **Send metadata to sinks** → `sendMetaToSink`
- **Send errors to sinks** → `sendError`
- **Concurrency** → `concurrency`
- **Buffer length** → `bufferLength`
- **Checkpoint interval** → `checkpointInterval`
- **Late tolerance** → `lateTolerance`
- **QoS** → `qos` 0, 1, or 2; **Engine default** omits it
- **Tags** → trimmed string array
- **Start after creation** → `triggered`; create-only and off by default

**Advanced options JSON** preserves and edits options not yet represented by structured controls, including restart strategies and future official properties.

### Generated definition pane

- Pipeline chips show source → SQL → every output.
- **Rule JSON** is the exact create/validate payload.
- **SQL** shows the exact generated query, or directs a graph-rule operator back to Rule JSON.
- The eye control masks/reveals sensitive values.
- Raw Rule JSON is locked while masked.
- **Apply definition** parses and projects an edited JSON definition back into the structured editor.
- **Discard** restores the generated definition.
- Dirty raw JSON blocks validation/save until it is applied or discarded.
- Validation success/error appears beside the definition and comes from the selected eKuiper node, not a client-only SQL guess.

## 4. Downstream fork adoption map

Audited fork: [`kenvaid/ekuiper-manager`](https://github.com/kenvaid/ekuiper-manager), five commits ahead at the audit point.

| Commit | Downstream change | Decision in this Manager |
| --- | --- | --- |
| [`4fbd3f3`](https://github.com/kenvaid/ekuiper-manager/commit/4fbd3f3) | Prisma compilation fallback | Not ported. Direct PostgreSQL, checked migrations, and fail-fast readiness replaced Prisma. |
| [`23b68ff`](https://github.com/kenvaid/ekuiper-manager/commit/23b68ff) | Number/boolean conversion and EdgeX fields | Adopted as schema/metadata-aware coercion; expanded to arrays, JSON, nested and unknown property preservation. |
| [`7193104`](https://github.com/kenvaid/ekuiper-manager/commit/7193104) | Duplicate rule dialog | Adopted with ID regex, collision check, allowed-definition-field copy, stopped-by-default behavior, confirmation, and browser coverage. |
| [`a6ed591`](https://github.com/kenvaid/ekuiper-manager/commit/a6ed591) | `sendSingle` boolean conversion | Adopted as a typed common/SQL sink property. |
| [`01d5b2d`](https://github.com/kenvaid/ekuiper-manager/commit/01d5b2d) | SQL sink and array fields | Adopted with typed string-array round trip and metadata merging. |

Unsafe or stale fork behavior intentionally excluded:

- Caller-supplied `X-EKuiper-URL` headers
- Hard-coded broker placeholder values
- lossy dropping of objects and unknown fields
- generic PUT upsert assumptions
- copying runtime/display fields into duplicates
- creating duplicates in a potentially running state
- fixed sink lists as the only source of installed capabilities

## 5. Verification

Unit coverage (`src/lib/__tests__/rule-designer.test.ts`) proves:

- typed and unknown sink values round-trip without loss;
- number, boolean, list, SQL `fields`, and `sendSingle` coercion;
- supported visual SQL generation/decomposition;
- recursive secret masking;
- duplicate sanitization and stopped-by-default behavior.

Browser coverage (`e2e/rule-designer.spec.ts`) proves against the bundled official eKuiper container:

1. `/query-designer` reaches the real designer.
2. A live stream is selected from the resource catalog.
3. Visual fields generate the expected SQL and rule JSON.
4. Official validation succeeds.
5. Creation persists the expected stopped rule.
6. Duplicate persists the same SQL/actions under a new ID and remains stopped.
7. Test rules and stream are removed.

## 6. Remaining work

- Implement real rule-test output over eKuiper's separate HTTP/SSE port with registered-node port policy, cancellation, timeout, and backpressure.
- Render every recursive metadata control shape, including grouped/nested entries and connector dependencies.
- Add an unsaved-changes navigation guard for structured and raw edits.
- Add visual joins and graph-rule authoring only when they can round-trip without loss.
- Add action connection testing where the installed metadata declares it, without reading secrets back into ordinary UI state.
- Add live API compatibility gates so fields unavailable on an older selected node are hidden or labelled.
