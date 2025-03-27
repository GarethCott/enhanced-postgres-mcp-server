#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { PostgresService } from './services/DatabaseService.js';
import { MigrationService } from './services/MigrationService.js';
import { SchemaService } from './services/SchemaService.js';
import { getDatabaseConfig, getMigrationConfig, getServerConfig } from './config/index.js';

// Get command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Please provide a database URL as a command-line argument");
  process.exit(1);
}

const databaseUrl = args[0];

// Initialize services
const dbService = new PostgresService(getDatabaseConfig(databaseUrl));
const migrationService = new MigrationService(getMigrationConfig(process.cwd()));
const schemaService = new SchemaService(dbService);

// Initialize server
const server = new Server(getServerConfig(), {
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Set up resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const tables = await schemaService.listTables();
  return {
    resources: tables.map((tableName: string) => ({
      uri: `postgres://${tableName}/schema`,
      mimeType: "application/json",
      name: `"${tableName}" database schema`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== "schema") {
    throw new Error("Invalid resource URI");
  }

  const tableSchema = await schemaService.getTableSchema(tableName!);
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(tableSchema, null, 2),
      },
    ],
  };
});

// Set up tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
      {
        name: "execute",
        description: "Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE)",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
      {
        name: "insert",
        description: "Insert a new record into a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string" },
            data: { 
              type: "object",
              additionalProperties: true
            },
          },
          required: ["table", "data"],
        },
      },
      {
        name: "update",
        description: "Update records in a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string" },
            data: { 
              type: "object",
              additionalProperties: true
            },
            where: { type: "string" },
          },
          required: ["table", "data", "where"],
        },
      },
      {
        name: "delete",
        description: "Delete records from a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string" },
            where: { type: "string" },
          },
          required: ["table", "where"],
        },
      },
      {
        name: "createTable",
        description: "Create a new table with specified columns and constraints",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            columns: { 
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  constraints: { type: "string", description: "Optional constraints like NOT NULL, UNIQUE, etc." }
                },
                required: ["name", "type"]
              }
            },
            constraints: {
              type: "array",
              items: {
                type: "string",
                description: "Table-level constraints like PRIMARY KEY, FOREIGN KEY, etc."
              }
            }
          },
          required: ["tableName", "columns"]
        },
      },
      {
        name: "createFunction",
        description: "Create a PostgreSQL function/procedure",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            parameters: { type: "string" },
            returnType: { type: "string" },
            language: { type: "string", description: "plpgsql, sql, etc." },
            body: { type: "string" },
            options: { type: "string", description: "Additional function options" }
          },
          required: ["name", "parameters", "returnType", "language", "body"]
        },
      },
      {
        name: "createTrigger",
        description: "Create a trigger on a table",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            tableName: { type: "string" },
            functionName: { type: "string" },
            when: { type: "string", description: "BEFORE, AFTER, or INSTEAD OF" },
            events: { 
              type: "array", 
              items: { type: "string", description: "INSERT, UPDATE, DELETE" } 
            },
            forEach: { type: "string", description: "ROW or STATEMENT" },
            condition: { type: "string", description: "Optional WHEN condition" }
          },
          required: ["name", "tableName", "functionName", "when", "events", "forEach"]
        },
      },
      {
        name: "createIndex",
        description: "Create an index on a table",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            indexName: { type: "string" },
            columns: { 
              type: "array",
              items: { type: "string" }
            },
            unique: { type: "boolean" },
            type: { type: "string", description: "BTREE, HASH, GIN, GIST, etc." },
            where: { type: "string", description: "Optional condition" }
          },
          required: ["tableName", "indexName", "columns"]
        },
      },
      {
        name: "alterTable",
        description: "Alter a table structure",
        inputSchema: {
          type: "object",
          properties: {
            tableName: { type: "string" },
            operation: { 
              type: "string", 
              description: "ADD COLUMN, DROP COLUMN, ALTER COLUMN, etc." 
            },
            details: { type: "string", description: "Specific details for the operation" }
          },
          required: ["tableName", "operation", "details"]
        },
      },
      {
        name: "listMigrations",
        description: "List all database migrations",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "applyMigrations",
        description: "Apply pending migrations to the database",
        inputSchema: {
          type: "object",
          properties: {
            fromId: { 
              type: "string",
              description: "Optional: Start applying from this migration ID"
            }
          }
        }
      },
      {
        name: "revertMigration",
        description: "Revert the last applied migration",
        inputSchema: {
          type: "object",
          properties: {
            migrationId: { 
              type: "string",
              description: "Optional: Revert this specific migration. If not provided, reverts the last one"
            }
          }
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "query": {
      const result = await dbService.query(request.params.arguments?.sql as string);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    case "execute": {
      const result = await dbService.execute(request.params.arguments?.sql as string);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    case "insert": {
      const table = request.params.arguments?.table as string;
      const data = request.params.arguments?.data as Record<string, any>;
      
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await dbService.execute(sql, values);
      
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    case "update": {
      const table = request.params.arguments?.table as string;
      const data = request.params.arguments?.data as Record<string, any>;
      const where = request.params.arguments?.where as string;
      
      const setClause = Object.entries(data)
        .map(([col, _], i) => `${col} = $${i + 1}`)
        .join(', ');
      
      const sql = `UPDATE ${table} SET ${setClause} WHERE ${where} RETURNING *`;
      const result = await dbService.execute(sql, Object.values(data));
      
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    case "delete": {
      const table = request.params.arguments?.table as string;
      const where = request.params.arguments?.where as string;
      
      const sql = `DELETE FROM ${table} WHERE ${where} RETURNING *`;
      const result = await dbService.execute(sql);
      
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    }

    case "createTable": {
      const sql = await schemaService.createTable(request.params.arguments as any);
      const migration = await migrationService.createMigration('table', sql, `Create table ${request.params.arguments?.tableName}`);
      const client = await dbService.getClient();
      
      try {
        await migrationService.applyMigration(client, migration);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: `Table created successfully`,
              sql,
              migration: {
                id: migration.id,
                name: migration.name
              }
            }, null, 2) 
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "createFunction": {
      const sql = await schemaService.createFunction(request.params.arguments as any);
      const migration = await migrationService.createMigration('function', sql, `Create function ${request.params.arguments?.name}`);
      const client = await dbService.getClient();
      
      try {
        await migrationService.applyMigration(client, migration);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: `Function created successfully`,
              sql,
              migration: {
                id: migration.id,
                name: migration.name
              }
            }, null, 2) 
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "createTrigger": {
      const sql = await schemaService.createTrigger(request.params.arguments as any);
      const migration = await migrationService.createMigration('trigger', sql, `Create trigger ${request.params.arguments?.name}`);
      const client = await dbService.getClient();
      
      try {
        await migrationService.applyMigration(client, migration);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: `Trigger created successfully`,
              sql,
              migration: {
                id: migration.id,
                name: migration.name
              }
            }, null, 2) 
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "createIndex": {
      const sql = await schemaService.createIndex(request.params.arguments as any);
      const migration = await migrationService.createMigration('index', sql, `Create index ${request.params.arguments?.indexName}`);
      const client = await dbService.getClient();
      
      try {
        await migrationService.applyMigration(client, migration);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: `Index created successfully`,
              sql,
              migration: {
                id: migration.id,
                name: migration.name
              }
            }, null, 2) 
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "alterTable": {
      const sql = await schemaService.alterTable(request.params.arguments as any);
      const migration = await migrationService.createMigration('alter', sql, `Alter table ${request.params.arguments?.tableName}`);
      const client = await dbService.getClient();
      
      try {
        await migrationService.applyMigration(client, migration);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: `Table altered successfully`,
              sql,
              migration: {
                id: migration.id,
                name: migration.name
              }
            }, null, 2) 
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "listMigrations": {
      const migrations = await migrationService.getMigrations();
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(migrations, null, 2)
        }],
        isError: false,
      };
    }

    case "applyMigrations": {
      const fromId = request.params.arguments?.fromId as string | undefined;
      const migrations = await migrationService.getMigrations();
      const client = await dbService.getClient();
      
      try {
        let shouldApply = !fromId;
        for (const migration of migrations) {
          if (migration.id === fromId) {
            shouldApply = true;
            continue;
          }
          if (shouldApply) {
            await migrationService.applyMigration(client, migration);
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: "Migrations applied successfully"
            }, null, 2)
          }],
          isError: false,
        };
      } finally {
        client.release();
      }
    }

    case "revertMigration": {
      const migrationId = request.params.arguments?.migrationId as string | undefined;
      const migrations = await migrationService.getMigrations();
      
      if (migrations.length === 0) {
        throw new Error("No migrations to revert");
      }
      
      const targetMigration = migrationId 
        ? migrations.find(m => m.id === migrationId)
        : migrations[migrations.length - 1];
        
      if (!targetMigration) {
        throw new Error("Migration not found");
      }
      
      const client = await dbService.getClient();
      try {
        const revertSql = await migrationService.generateRevertSql(targetMigration);
        await client.query('BEGIN');
        await client.query(revertSql);
        await client.query('COMMIT');
        
        await migrationService.removeMigration(targetMigration.id);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              message: "Migration reverted successfully",
              revertedMigration: targetMigration,
              revertSql
            }, null, 2)
          }],
          isError: false,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error); 