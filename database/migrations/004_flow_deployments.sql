-- FS-0084: flow deployment attempts (no revision FK yet, no runtime metrics).
--
-- Redaction decision (inspected current built-ins before writing):
-- - mqtt-source/mqtt-sink expose only topic + connectionSelector (a shared
--   connection reference); broker credentials stay inside the eKuiper
--   connection and never enter the Flow document.
-- - rest-sink exposes a free-form `headers` JSON object which is compiled
--   verbatim into the eKuiper rule definition (see
--   src/lib/flows/compiler/ekuiper/compile-graph.ts). Headers can carry
--   Authorization bearer tokens / API keys, so the compiled definition CAN
--   contain secrets for a supported node.
-- Per the ticket ("do not store plaintext secrets ... store a redacted
-- compiled definition only and explicitly name column accordingly"), this
-- table persists ONLY the redacted compiled definition in the explicitly
-- named `redacted_compiled_definition` column. The full unredacted payload
-- exists only transiently server-side immediately before the eKuiper
-- management request and is never persisted here.
CREATE TABLE flow_deployments (
  id text PRIMARY KEY,
  flow_id text NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  target_node_id text REFERENCES managed_nodes(id) ON DELETE SET NULL,
  semantic_hash text NOT NULL,
  compiler_version integer NOT NULL,
  rule_id text NOT NULL,
  redacted_compiled_definition jsonb NOT NULL,
  runtime_node_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  error text,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flow_deployments_flow_id_idx ON flow_deployments(flow_id);
CREATE INDEX flow_deployments_flow_target_created_idx
  ON flow_deployments(flow_id, target_node_id, created_at DESC);

COMMENT ON TABLE flow_deployments IS 'FS-0084: append-only flow deployment attempts; latest successful row is the active deployment.';
COMMENT ON COLUMN flow_deployments.redacted_compiled_definition IS 'Redacted-only compiled eKuiper rule definition (inspectable artifact without plaintext secrets, e.g. REST sink headers); never persist unredacted secrets here.';
COMMENT ON COLUMN flow_deployments.runtime_node_map IS 'Flow node ID -> deterministic runtime operator ID.';
COMMENT ON COLUMN flow_deployments.error IS 'Bounded/sanitized failure summary; never raw secret-bearing response bodies.';
