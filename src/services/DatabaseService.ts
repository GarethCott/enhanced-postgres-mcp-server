import { Pool, PoolClient } from 'pg';
import { DatabaseConfig, DatabaseService } from '../types/index.js';

export class PostgresService implements DatabaseService {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(config);
  }

  async query(sql: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN TRANSACTION READ ONLY');
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, params);
      await client.query('COMMIT');
      return {
        command: result.command,
        rowCount: result.rowCount,
        rows: result.rows
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 