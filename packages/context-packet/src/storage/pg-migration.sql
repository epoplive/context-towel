-- Packet v2 Postgres Schema
-- Run this migration to create tables for PgPacketStore

CREATE TABLE IF NOT EXISTS packet_meta (
  name TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  plan_file_ref TEXT,
  tags TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS packet_versions (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL REFERENCES packet_meta(name) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  trigger TEXT NOT NULL,
  content TEXT NOT NULL,
  delta_from_prev TEXT
);
CREATE INDEX IF NOT EXISTS idx_packet_versions_name ON packet_versions(packet_name, timestamp);

CREATE TABLE IF NOT EXISTS packet_deltas (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL REFERENCES packet_meta(name) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  node_id TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_packet_deltas_name ON packet_deltas(packet_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_packet_deltas_node ON packet_deltas(packet_name, node_id);

CREATE TABLE IF NOT EXISTS packet_keyframes (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL REFERENCES packet_meta(name) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  trigger_node_id TEXT NOT NULL,
  content TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_packet_keyframes_name ON packet_keyframes(packet_name, trigger_node_id);

CREATE TABLE IF NOT EXISTS packet_edges (
  id TEXT PRIMARY KEY,
  packet_name TEXT NOT NULL REFERENCES packet_meta(name) ON DELETE CASCADE,
  source_node TEXT NOT NULL,
  target_node TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_packet_edges_name ON packet_edges(packet_name);
CREATE INDEX IF NOT EXISTS idx_packet_edges_source ON packet_edges(packet_name, source_node);
CREATE INDEX IF NOT EXISTS idx_packet_edges_target ON packet_edges(packet_name, target_node);

CREATE TABLE IF NOT EXISTS packet_patterns (
  id TEXT PRIMARY KEY,
  subsystem TEXT NOT NULL,
  codebase TEXT,
  content TEXT NOT NULL,
  source_packet TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0
);
CREATE INDEX IF NOT EXISTS idx_packet_patterns_subsystem ON packet_patterns(subsystem);

-- Document artifacts stored in DB instead of filesystem
CREATE TABLE IF NOT EXISTS packet_docs (
  id SERIAL PRIMARY KEY,
  packet_name TEXT NOT NULL REFERENCES packet_meta(name) ON DELETE CASCADE,
  doc_path TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(packet_name, doc_path)
);
CREATE INDEX IF NOT EXISTS idx_packet_docs_name ON packet_docs(packet_name);
