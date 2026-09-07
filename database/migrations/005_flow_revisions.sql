-- FS-0091: immutable flow revisions (no deployment FK in this ticket).
CREATE TABLE flow_revisions (
  id text PRIMARY KEY,
  flow_id text NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  semantic_document jsonb NOT NULL,
  layout_document jsonb NOT NULL,
  semantic_hash text NOT NULL,
  layout_hash text NOT NULL,
  compiler_version integer,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  message text,
  UNIQUE (flow_id, revision_number)
);

CREATE INDEX flow_revisions_created_by_idx ON flow_revisions(created_by);

COMMENT ON TABLE flow_revisions IS 'FS-0091: immutable flow revision snapshots; unique (flow_id, revision_number).';
