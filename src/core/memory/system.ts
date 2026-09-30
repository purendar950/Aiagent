import type { CodeGraph, CodeEntity, CodeRelationship } from '../agent/types.js';
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuid } from 'uuid';

export interface Reflection {
  taskId: string;
  reflection: string;
  timestamp: number;
}

export interface Interaction {
  id: string;
  type: 'success' | 'failure' | 'preference' | 'pattern';
  description: string;
  context: string;
  timestamp: number;
}

export class MemorySystem {
  private db: Database.Database;
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
    const dbPath = resolve(workingDirectory, '.perfect-agent', 'memory.db');
    
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });
    
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reflections (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        reflection TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        context TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS code_entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        file TEXT NOT NULL,
        line_start INTEGER,
        line_end INTEGER,
        signature TEXT,
        docstring TEXT
      );

      CREATE TABLE IF NOT EXISTS code_relationships (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_name ON code_entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_file ON code_entities(file);
      CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
    `);
  }

  async storeReflection(reflection: Reflection): Promise<void> {
    this.db.prepare(`
      INSERT INTO reflections (id, task_id, reflection, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), reflection.taskId, reflection.reflection, reflection.timestamp);
  }

  async storeInteraction(interaction: Interaction): Promise<void> {
    this.db.prepare(`
      INSERT INTO interactions (id, type, description, context, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid(), interaction.type, interaction.description, interaction.context, interaction.timestamp);
  }

  async storeCodeEntity(entity: CodeEntity): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO code_entities (id, type, name, file, line_start, line_end, signature, docstring)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entity.id, entity.type, entity.name, entity.file, entity.lineStart, entity.lineEnd, entity.signature, entity.docstring);
  }

  async storeCodeRelationship(relationship: CodeRelationship): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO code_relationships (id, from_id, to_id, type)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), relationship.from, relationship.to, relationship.type);
  }

  async getCodeGraph(): Promise<CodeGraph> {
    const entities = this.db.prepare('SELECT * FROM code_entities').all() as any[];
    const relationships = this.db.prepare('SELECT * FROM code_relationships').all() as any[];

    return {
      entities: entities.map(e => ({
        id: e.id,
        type: e.type,
        name: e.name,
        file: e.file,
        lineStart: e.line_start,
        lineEnd: e.line_end,
        signature: e.signature,
        docstring: e.docstring,
      })),
      relationships: relationships.map(r => ({
        from: r.from_id,
        to: r.to_id,
        type: r.type,
      })),
    };
  }

  async searchInteractions(type: string, limit: number = 10): Promise<Interaction[]> {
    const results = this.db.prepare(`
      SELECT * FROM interactions WHERE type = ? ORDER BY timestamp DESC LIMIT ?
    `).all(type, limit) as any[];

    return results.map(r => ({
      id: r.id,
      type: r.type,
      description: r.description,
      context: r.context,
      timestamp: r.timestamp,
    }));
  }

  async getPreference(key: string): Promise<string | null> {
    const result = this.db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as any;
    return result?.value || null;
  }

  async setPreference(key: string, value: string): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO preferences (id, key, value, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(uuid(), key, value, Date.now());
  }

  async getRecentReflections(limit: number = 5): Promise<Reflection[]> {
    const results = this.db.prepare(`
      SELECT * FROM reflections ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return results.map(r => ({
      taskId: r.task_id,
      reflection: r.reflection,
      timestamp: r.timestamp,
    }));
  }

  async findSimilarPatterns(description: string, limit: number = 5): Promise<Interaction[]> {
    const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const results = this.db.prepare(`
      SELECT * FROM interactions
      WHERE type = 'pattern'
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit * 3) as any[];

    return results
      .filter(r => {
        const desc = r.description.toLowerCase();
        return keywords.some(k => desc.includes(k));
      })
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        type: r.type,
        description: r.description,
        context: r.context,
        timestamp: r.timestamp,
      }));
  }

  close(): void {
    this.db.close();
  }
}
