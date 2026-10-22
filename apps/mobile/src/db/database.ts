import { open, type DB } from '@op-engineering/op-sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  deleted_at TEXT,
  favorite INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  folder_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  document_type TEXT DEFAULT 'DOCUMENT',
  favorite INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  deleted_at TEXT,
  page_count INTEGER DEFAULT 0,
  size INTEGER DEFAULT 0,
  ocr_text TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  rotation INTEGER DEFAULT 0,
  filter TEXT DEFAULT 'original',
  ocr_text TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tags (
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (document_id, tag)
);
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  op TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL
);
`;

let database: DB | null = null;

export function getDatabase(): DB {
  if (!database) {
    database = open({ name: 'scanflow.db' });
    database.executeSync(SCHEMA);
  }
  return database;
}
