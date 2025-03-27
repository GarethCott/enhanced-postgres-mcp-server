# PostgreSQL MCP Server (Enhanced)

A Model Context Protocol server that provides both read and write access to PostgreSQL databases. This server enables LLMs to inspect database schemas, execute queries, modify data, and create/modify database schema objects.

> **Note:** This is an enhanced version of the original [PostgreSQL MCP server](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) by Anthropic. The original server provides read-only access, while this enhanced version adds write capabilities, schema management, automated migration tracking, and follows modern programming best practices.

## Project Structure

This project follows a clean, modular architecture:

```
enhanced-postgres-mcp-server/
├── src/                      # Source code
│   ├── config/               # Configuration management
│   ├── services/             # Service implementations
│   │   ├── DatabaseService.ts  # Database operations
│   │   ├── MigrationService.ts # Migration management
│   │   └── SchemaService.ts    # Schema operations
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   └── index.ts              # Main entry point
├── dist/                     # Compiled JavaScript (built)
├── migrations/               # Generated migration files
├── Dockerfile                # Docker configuration
├── package.json              # Project dependencies
└── tsconfig.json             # TypeScript configuration
```

## Components

### Migration Management

The server includes an automated migration management system that:

- Automatically tracks all schema changes
- Generates versioned migration files
- Maintains a complete history of database changes
- Supports applying migrations across different environments
- Provides rollback capabilities

Each migration includes:
- Unique ID and timestamp
- Migration type (table, function, trigger, index, alter)
- SQL statement
- Description
- Checksum for integrity verification

Migrations are stored in:
- Individual `.sql` files in the `migrations` directory
- A `metadata.json` file tracking all migrations

### Tools

#### Migration Management
- **listMigrations**
  - List all tracked database migrations
  - Shows complete migration history with details

- **applyMigrations**
  - Apply pending migrations to the database
  - Input:
    - `fromId` (string, optional): Start applying from this migration ID
  - Useful for syncing different environments

- **revertMigration**
  - Revert the last applied migration or a specific one
  - Input:
    - `migrationId` (string, optional): Specific migration to revert
  - Automatically generates appropriate DROP statements
  - Supports reverting:
    - Tables
    - Functions
    - Triggers
    - Indexes

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

## Installation & Usage

### Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Development mode:**
```bash
npm run dev -- postgresql://user:password@localhost:5432/dbname
```

3. **Build for production:**
```bash
npm run build
```

4. **Run in production:**
```bash
npm start -- postgresql://user:password@localhost:5432/dbname
```

### Docker Deployment

1. **Build Docker image:**
```bash
npm run docker:build
# or directly:
docker build -t mcp/postgres .
```

2. **Run with Docker:**
```bash
npm run docker:run -- postgresql://user:password@host:5432/dbname
# or directly:
docker run -i --rm mcp/postgres postgresql://user:password@host:5432/dbname
```

> **Note:** When running in Docker on macOS, use `host.docker.internal` instead of `localhost` to access the host machine.

## Development

The project includes several developer tools:

- **Linting:** `npm run lint`
- **Formatting:** `npm run format`
- **Testing:** `npm run test`

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

### Migration Management Examples

List all migrations:
```
/listMigrations
```

Apply pending migrations:
```
/applyMigrations
```

Apply migrations starting from a specific one:
```
/applyMigrations fromId="1234567890_abcd"
```

Revert last migration:
```
/revertMigration
```

Revert specific migration:
```
/revertMigration migrationId="1234567890_abcd"
```

### Create a Table with Migration Tracking
```
/createTable tableName="tasks", columns=[
  {"name": "id", "type": "SERIAL", "constraints": "PRIMARY KEY"}, 
  {"name": "title", "type": "VARCHAR(100)", "constraints": "NOT NULL"},
  {"name": "created_at", "type": "TIMESTAMP", "constraints": "DEFAULT CURRENT_TIMESTAMP"}
]
```
This will:
1. Create the table
2. Generate a migration file in `migrations/`
3. Update the migration metadata
4. Return the migration ID for reference

## Migration Files

Migrations are stored in two locations:

1. **SQL Files** (`migrations/*.sql`):
   ```sql
   -- Migration: table_1234567890
   -- Type: table
   -- Description: Create table tasks
   -- Timestamp: 2024-03-21T10:30:00.000Z

   CREATE TABLE tasks (id SERIAL PRIMARY KEY, ...);
   ```

2. **Metadata** (`migrations/metadata.json`):
   ```json
   {
     "migrations": [
       {
         "id": "1234567890_abcd",
         "name": "table_1234567890",
         "timestamp": 1234567890000,
         "type": "table",
         "sql": "CREATE TABLE tasks...",
         "description": "Create table tasks",
         "checksum": "abc123..."
       }
     ]
   }
   ```

## Development Workflow

1. **Local Development:**
   - Make schema changes using MCP tools
   - Migrations are automatically tracked
   - Review changes in `migrations/` directory

2. **Staging/Production Deployment:**
   - Use `/listMigrations` to view pending changes
   - Apply migrations with `/applyMigrations`
   - Rollback if needed with `/revertMigration`

## Security Considerations

1. All data modification operations use transactions with proper COMMIT/ROLLBACK handling
2. Each operation returns the SQL that was executed for transparency
3. The server uses parameterized queries for insert/update operations to prevent SQL injection
4. Migrations include checksums to verify integrity
5. Revert operations are generated safely based on migration type

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
