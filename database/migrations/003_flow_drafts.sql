CREATE TABLE flow_drafts (
  flow_id text PRIMARY KEY REFERENCES flows(id) ON DELETE CASCADE,
  semantic_document jsonb NOT NULL,
  layout_document jsonb NOT NULL,
  semantic_hash text NOT NULL,
  layout_hash text NOT NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flow_drafts_updated_by_idx ON flow_drafts(updated_by);
