import { PoolClient } from 'pg';

export interface Migration {
  id: string;
  name: string;
  timestamp: number;
  sql: string;
  type: MigrationType;
  description?: string;
  checksum: string;
}

export type MigrationType = 'table' | 'function' | 'trigger' | 'index' | 'alter';

export interface DatabaseConfig {
  connectionString: string;
}

export interface MigrationConfig {
  migrationsDir: string;
  metadataFile: string;
}

export interface ServerConfig {
  name: string;
  version: string;
  [key: string]: unknown;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  constraints?: string;
}

export interface CreateTableParams {
  tableName: string;
  columns: ColumnDefinition[];
  constraints?: string[];
}

export interface CreateFunctionParams {
  name: string;
  parameters: string;
  returnType: string;
  language: string;
  body: string;
  options?: string;
}

export interface CreateTriggerParams {
  name: string;
  tableName: string;
  functionName: string;
  when: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  events: ('INSERT' | 'UPDATE' | 'DELETE')[];
  forEach: 'ROW' | 'STATEMENT';
  condition?: string;
}

export interface CreateIndexParams {
  tableName: string;
  indexName: string;
  columns: string[];
  unique?: boolean;
  type?: string;
  where?: string;
}

export interface AlterTableParams {
  tableName: string;
  operation: string;
  details: string;
}

export interface DatabaseService {
  query(sql: string, params?: any[]): Promise<any>;
  execute(sql: string, params?: any[]): Promise<any>;
  getClient(): Promise<PoolClient>;
  close(): Promise<void>;
} 