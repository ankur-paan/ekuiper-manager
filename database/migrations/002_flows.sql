CREATE TABLE flows (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  target_node_id text REFERENCES managed_nodes(id) ON DELETE SET NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flows_target_node_id_idx ON flows(target_node_id);
CREATE INDEX flows_created_by_idx ON flows(created_by);
