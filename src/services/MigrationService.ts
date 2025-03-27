import { PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { 
  Migration, 
  MigrationType, 
  MigrationConfig 
} from '../types/index.js';

export class MigrationService {
  private migrationsDir: string;
  private metadataFile: string;

  constructor(config: MigrationConfig) {
    this.migrationsDir = config.migrationsDir;
    this.metadataFile = config.metadataFile;
  }

  private async ensureMigrationsDir(): Promise<void> {
    try {
      await fs.access(this.migrationsDir);
    } catch {
      await fs.mkdir(this.migrationsDir, { recursive: true });
      await fs.writeFile(this.metadataFile, JSON.stringify({ migrations: [] }, null, 2));
    }
  }

  private generateMigrationId(): string {
    return Date.now().toString() + '_' + crypto.randomBytes(4).toString('hex');
  }

  private generateChecksum(sql: string): string {
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  async createMigration(type: MigrationType, sql: string, description?: string): Promise<Migration> {
    await this.ensureMigrationsDir();
    
    const migration: Migration = {
      id: this.generateMigrationId(),
      name: `${type}_${Date.now()}`,
      timestamp: Date.now(),
      sql,
      type,
      description,
      checksum: this.generateChecksum(sql)
    };

    // Write migration file
    const migrationFile = path.join(this.migrationsDir, `${migration.id}.sql`);
    const migrationContent = `-- Migration: ${migration.name}
-- Type: ${migration.type}
-- Description: ${migration.description || 'No description provided'}
-- Timestamp: ${new Date(migration.timestamp).toISOString()}

${migration.sql}
`;
    await fs.writeFile(migrationFile, migrationContent);

    // Update metadata
    const metadata = JSON.parse(await fs.readFile(this.metadataFile, 'utf-8'));
    metadata.migrations.push(migration);
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));

    return migration;
  }

  async getMigrations(): Promise<Migration[]> {
    try {
      const metadata = JSON.parse(await fs.readFile(this.metadataFile, 'utf-8'));
      return metadata.migrations;
    } catch {
      return [];
    }
  }

  async applyMigration(client: PoolClient, migration: Migration): Promise<void> {
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  async removeMigration(migrationId: string): Promise<void> {
    // Read and update metadata
    const metadata = JSON.parse(await fs.readFile(this.metadataFile, 'utf-8'));
    metadata.migrations = metadata.migrations.filter((m: Migration) => m.id !== migrationId);
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));

    // Delete migration file
    const migrationFile = path.join(this.migrationsDir, `${migrationId}.sql`);
    await fs.unlink(migrationFile);
  }

  async generateRevertSql(migration: Migration): Promise<string> {
    switch (migration.type) {
      case 'table':
        return `DROP TABLE IF EXISTS ${migration.sql.split(' ')[2]}`;
      case 'function':
        const functionName = migration.sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/i)?.[1];
        return functionName ? `DROP FUNCTION IF EXISTS ${functionName}` : '';
      case 'trigger':
        const matches = migration.sql.match(/CREATE\s+TRIGGER\s+([^\s]+)\s+.*?ON\s+([^\s]+)/i);
        if (matches) {
          const [_, triggerName, tableName] = matches;
          return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName}`;
        }
        return '';
      case 'index':
        const indexName = migration.sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+([^\s]+)/i)?.[1];
        return indexName ? `DROP INDEX IF EXISTS ${indexName}` : '';
      default:
        throw new Error(`Revert not implemented for migration type: ${migration.type}`);
    }
  }
} 