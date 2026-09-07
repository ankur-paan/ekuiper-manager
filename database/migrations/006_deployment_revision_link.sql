-- FS-0093: link flow deployment attempts to the exact revision they deploy.
--
-- Additive only: never edits applied migrations. The column is nullable so
-- pre-FS-0093 deployment rows remain valid with a NULL link. New attempts
-- created after validation store the reused or newly created revision id;
-- a failed runtime mutation keeps its failed status while the revision
-- remains as a historical snapshot (a revision alone never reads as
-- deployed).
ALTER TABLE flow_deployments
  ADD COLUMN revision_id text REFERENCES flow_revisions(id) ON DELETE SET NULL;

CREATE INDEX flow_deployments_revision_id_idx ON flow_deployments(revision_id);

COMMENT ON COLUMN flow_deployments.revision_id IS 'FS-0093: flow_revisions id representing the exact draft (semantic+layout) this attempt deploys; NULL for pre-link rows.';
