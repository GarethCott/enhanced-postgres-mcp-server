# PostgreSQL MCP Server (Enhanced)

A Model Context Protocol server that provides both read and write access to PostgreSQL databases. This server enables LLMs to inspect database schemas, execute queries, modify data, and create/modify database schema objects.

> **Note:** This is an enhanced version of the original [PostgreSQL MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) by Anthropic. The original server provides read-only access, while this enhanced version adds write capabilities and schema management.

## Components

### Tools

#### Data Query
- **query**
  - Execute read-only SQL queries against the connected database
  - Input: `sql` (string): The SQL query to execute
  - All queries are executed within a READ ONLY transaction

#### Data Modification
- **execute**
  - Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE)
  - Input: `sql` (string): The SQL statement to execute
  - Executed within a transaction with proper COMMIT/ROLLBACK handling

- **insert**
  - Insert a new record into a table
  - Input: 
    - `table` (string): The table name
    - `data` (object): Key-value pairs where keys are column names and values are the data to insert

- **update**
  - Update records in a table
  - Input: 
    - `table` (string): The table name
    - `data` (object): Key-value pairs for the fields to update
    - `where` (string): The WHERE condition to identify records to update

- **delete**
  - Delete records from a table
  - Input: 
    - `table` (string): The table name
    - `where` (string): The WHERE condition to identify records to delete

#### Schema Management
- **createTable**
  - Create a new table with specified columns and constraints
  - Input:
    - `tableName` (string): The table name
    - `columns` (array): Array of column definitions with name, type, and optional constraints
    - `constraints` (array): Optional array of table-level constraints

- **createFunction**
  - Create a PostgreSQL function/procedure
  - Input:
    - `name` (string): Function name
    - `parameters` (string): Function parameters
    - `returnType` (string): Return type
    - `language` (string): Language (plpgsql, sql, etc.)
    - `body` (string): Function body
    - `options` (string): Optional additional function options

- **createTrigger**
  - Create a trigger on a table
  - Input:
    - `name` (string): Trigger name
    - `tableName` (string): Table to apply trigger to
    - `functionName` (string): Function to call
    - `when` (string): BEFORE, AFTER, or INSTEAD OF
    - `events` (array): Array of events (INSERT, UPDATE, DELETE)
    - `forEach` (string): ROW or STATEMENT
    - `condition` (string): Optional WHEN condition

- **createIndex**
  - Create an index on a table
  - Input:
    - `tableName` (string): Table name
    - `indexName` (string): Index name
    - `columns` (array): Columns to index
    - `unique` (boolean): Whether the index is unique
    - `type` (string): Optional index type (BTREE, HASH, GIN, GIST, etc.)
    - `where` (string): Optional condition

- **alterTable**
  - Alter a table structure
  - Input:
    - `tableName` (string): Table name
    - `operation` (string): Operation (ADD COLUMN, DROP COLUMN, etc.)
    - `details` (string): Operation details

### Resources

The server provides schema information for each table in the database:

- **Table Schemas** (`postgres://<host>/<table>/schema`)
  - JSON schema information for each table
  - Includes column names and data types
  - Automatically discovered from database metadata

## Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

### Docker

* when running docker on macos, use host.docker.internal if the server is running on the host network (eg localhost)
* username/password can be added to the postgresql url with `postgresql://user:password@host:port/db-name`
* add `?sslmode=no-verify` if you need to bypass SSL certificate verification

```json
{
  "mcpServers": {
    "postgres": {
      "command": "docker",
      "args": [
        "run", 
        "-i", 
        "--rm", 
        "mcp/postgres", 
        "postgresql://host.docker.internal:5432/mydb"]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/mydb"
      ]
    }
  }
}
```

Replace `/mydb` with your database name.

## Example Usage

### Query Data
```
/query SELECT * FROM users LIMIT 5
```

### Insert Data
```
/insert table="users", data={"name": "John Doe", "email": "john@example.com"}
```

### Update Data
```
/update table="users", data={"status": "inactive"}, where="id='123'"
```

### Create a Table
```
/createTable tableName="tasks", columns=[
  {"name": "id", "type": "SERIAL", "constraints": "PRIMARY KEY"}, 
  {"name": "title", "type": "VARCHAR(100)", "constraints": "NOT NULL"},
  {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
]
```

### Create a Function and Trigger
```
/createFunction name="update_timestamp", parameters="", returnType="TRIGGER", language="plpgsql", body="BEGIN NEW.updated_at = NOW(); RETURN NEW; END;"

/createTrigger name="set_timestamp", tableName="tasks", functionName="update_timestamp", when="BEFORE", events=["UPDATE"], forEach="ROW"
```

## Building

Docker:

```sh
docker build -t mcp/postgres -f Dockerfile . 
```

## Security Considerations

1. All data modification operations use transactions with proper COMMIT/ROLLBACK handling
2. Each operation returns the SQL that was executed for transparency
3. The server uses parameterized queries for insert/update operations to prevent SQL injection

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
