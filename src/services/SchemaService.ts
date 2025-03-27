import { 
  DatabaseService,
  CreateTableParams,
  CreateFunctionParams,
  CreateTriggerParams,
  CreateIndexParams,
  AlterTableParams
} from '../types/index.js';

export class SchemaService {
  constructor(private db: DatabaseService) {}

  async createTable(params: CreateTableParams): Promise<string> {
    const columnDefinitions = params.columns.map(col => {
      return `${col.name} ${col.type}${col.constraints ? ' ' + col.constraints : ''}`;
    }).join(', ');
    
    const tableConstraints = params.constraints ? ', ' + params.constraints.join(', ') : '';
    
    return `CREATE TABLE ${params.tableName} (${columnDefinitions}${tableConstraints})`;
  }

  async createFunction(params: CreateFunctionParams): Promise<string> {
    return `
      CREATE OR REPLACE FUNCTION ${params.name}(${params.parameters})
      RETURNS ${params.returnType}
      LANGUAGE ${params.language}
      ${params.options || ''}
      AS $$
      ${params.body}
      $$;
    `;
  }

  async createTrigger(params: CreateTriggerParams): Promise<string> {
    const eventStr = params.events.join(' OR ');
    const whenClause = params.condition ? `WHEN (${params.condition})` : '';
    
    return `
      CREATE TRIGGER ${params.name}
      ${params.when} ${eventStr}
      ON ${params.tableName}
      FOR EACH ${params.forEach}
      ${whenClause}
      EXECUTE FUNCTION ${params.functionName}();
    `;
  }

  async createIndex(params: CreateIndexParams): Promise<string> {
    const uniqueStr = params.unique ? 'UNIQUE' : '';
    const typeStr = params.type ? `USING ${params.type}` : '';
    const whereClause = params.where ? `WHERE ${params.where}` : '';
    
    return `
      CREATE ${uniqueStr} INDEX ${params.indexName}
      ON ${params.tableName} ${typeStr} (${params.columns.join(', ')})
      ${whereClause}
    `;
  }

  async alterTable(params: AlterTableParams): Promise<string> {
    return `ALTER TABLE ${params.tableName} ${params.operation} ${params.details}`;
  }

  async getTableSchema(tableName: string): Promise<any[]> {
    return await this.db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
      [tableName]
    );
  }

  async listTables(): Promise<string[]> {
    const result = await this.db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    return result.map((row: any) => row.table_name);
  }
} 