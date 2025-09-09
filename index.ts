#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as pg from "pg";

const server = new Server(
  {
    name: "example-servers/postgres",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

const args = process.argv.slice(2);
const databaseUrl = args[0] || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Please provide a database URL as a command-line argument or DATABASE_URL environment variable");
  process.exit(1);
}

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const SCHEMA_PATH = "schema";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    return {
      resources: result.rows.map((row) => ({
        uri: new URL(`${row.table_name}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `"${row.table_name}" database schema`,
      })),
    };
  } finally {
    client.release();
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);

  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
      [tableName],
    );

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(result.rows, null, 2),
        },
      ],
    };
  } finally {
    client.release();
  }
});

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
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    const sql = request.params.arguments?.sql as string;

    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(sql);
      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      throw error;
    } finally {
      client
        .query("ROLLBACK")
        .catch((error) =>
          console.warn("Could not roll back transaction:", error),
        );

      client.release();
    }
  } else if (request.params.name === "execute") {
    const sql = request.params.arguments?.sql as string;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(sql);
      await client.query("COMMIT");
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            command: result.command,
            rowCount: result.rowCount,
            rows: result.rows
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "insert") {
    const table = request.params.arguments?.table as string;
    const data = request.params.arguments?.data as Record<string, any>;
    
    const client = await pool.connect();
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      await client.query("COMMIT");
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result.rows, null, 2)
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "update") {
    const table = request.params.arguments?.table as string;
    const data = request.params.arguments?.data as Record<string, any>;
    const where = request.params.arguments?.where as string;
    
    const client = await pool.connect();
    try {
      const setClause = Object.entries(data)
        .map(([col, _], i) => `${col} = $${i + 1}`)
        .join(', ');
      
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE ${table} SET ${setClause} WHERE ${where} RETURNING *`,
        Object.values(data)
      );
      await client.query("COMMIT");
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result.rows, null, 2)
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "delete") {
    const table = request.params.arguments?.table as string;
    const where = request.params.arguments?.where as string;
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${where} RETURNING *`
      );
      await client.query("COMMIT");
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result.rows, null, 2)
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "createTable") {
    const tableName = request.params.arguments?.tableName as string;
    const columns = request.params.arguments?.columns as Array<{
      name: string;
      type: string;
      constraints?: string;
    }>;
    const constraints = request.params.arguments?.constraints as Array<string>;
    
    const client = await pool.connect();
    try {
      const columnDefinitions = columns.map(col => {
        return `${col.name} ${col.type}${col.constraints ? ' ' + col.constraints : ''}`;
      }).join(', ');
      
      const tableConstraints = constraints ? ', ' + constraints.join(', ') : '';
      
      const createTableSQL = `CREATE TABLE ${tableName} (${columnDefinitions}${tableConstraints})`;
      
      await client.query('BEGIN');
      await client.query(createTableSQL);
      await client.query('COMMIT');
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            message: `Table ${tableName} created successfully`,
            sql: createTableSQL
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "createFunction") {
    const name = request.params.arguments?.name as string;
    const parameters = request.params.arguments?.parameters as string;
    const returnType = request.params.arguments?.returnType as string;
    const language = request.params.arguments?.language as string;
    const body = request.params.arguments?.body as string;
    const options = request.params.arguments?.options as string;
    
    const client = await pool.connect();
    try {
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION ${name}(${parameters})
        RETURNS ${returnType}
        LANGUAGE ${language}
        ${options || ''}
        AS $$
        ${body}
        $$;
      `;
      
      await client.query('BEGIN');
      await client.query(createFunctionSQL);
      await client.query('COMMIT');
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            message: `Function ${name} created successfully`,
            sql: createFunctionSQL
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "createTrigger") {
    const name = request.params.arguments?.name as string;
    const tableName = request.params.arguments?.tableName as string;
    const functionName = request.params.arguments?.functionName as string;
    const when = request.params.arguments?.when as string;
    const events = request.params.arguments?.events as string[];
    const forEach = request.params.arguments?.forEach as string;
    const condition = request.params.arguments?.condition as string;
    
    const client = await pool.connect();
    try {
      const eventStr = events.join(' OR ');
      const whenClause = condition ? `WHEN (${condition})` : '';
      
      const createTriggerSQL = `
        CREATE TRIGGER ${name}
        ${when} ${eventStr}
        ON ${tableName}
        FOR EACH ${forEach}
        ${whenClause}
        EXECUTE FUNCTION ${functionName}();
      `;
      
      await client.query('BEGIN');
      await client.query(createTriggerSQL);
      await client.query('COMMIT');
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            message: `Trigger ${name} created successfully on table ${tableName}`,
            sql: createTriggerSQL
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "createIndex") {
    const tableName = request.params.arguments?.tableName as string;
    const indexName = request.params.arguments?.indexName as string;
    const columns = request.params.arguments?.columns as string[];
    const unique = request.params.arguments?.unique as boolean;
    const type = request.params.arguments?.type as string;
    const where = request.params.arguments?.where as string;
    
    const client = await pool.connect();
    try {
      const uniqueStr = unique ? 'UNIQUE' : '';
      const typeStr = type ? `USING ${type}` : '';
      const whereClause = where ? `WHERE ${where}` : '';
      
      const createIndexSQL = `
        CREATE ${uniqueStr} INDEX ${indexName}
        ON ${tableName} ${typeStr} (${columns.join(', ')})
        ${whereClause}
      `;
      
      await client.query('BEGIN');
      await client.query(createIndexSQL);
      await client.query('COMMIT');
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            message: `Index ${indexName} created successfully on table ${tableName}`,
            sql: createIndexSQL
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  } else if (request.params.name === "alterTable") {
    const tableName = request.params.arguments?.tableName as string;
    const operation = request.params.arguments?.operation as string;
    const details = request.params.arguments?.details as string;
    
    const client = await pool.connect();
    try {
      const alterTableSQL = `ALTER TABLE ${tableName} ${operation} ${details}`;
      
      await client.query('BEGIN');
      await client.query(alterTableSQL);
      await client.query('COMMIT');
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            message: `Table ${tableName} altered successfully`,
            sql: alterTableSQL
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(err => 
        console.warn("Could not roll back transaction:", err)
      );
      throw error;
    } finally {
      client.release();
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
