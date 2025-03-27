import path from 'path';
import { DatabaseConfig, MigrationConfig, ServerConfig } from '../types/index.js';

export function getDatabaseConfig(databaseUrl: string): DatabaseConfig {
  return {
    connectionString: databaseUrl
  };
}

export function getMigrationConfig(workingDir: string): MigrationConfig {
  return {
    migrationsDir: path.join(workingDir, 'migrations'),
    metadataFile: path.join(workingDir, 'migrations', 'metadata.json')
  };
}

export function getServerConfig(): ServerConfig {
  return {
    name: "example-servers/postgres",
    version: "0.1.0"
  };
} 