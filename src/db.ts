import sqllite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Mutex } from 'async-mutex';

import { Path } from '@asmartbear/filesystem';
import * as D from '@asmartbear/dyn'

import { NativeForRowColumns, NativeUpdateForSchemaColumns, PrimaryKeyForSchemaColumns, SchemaTable } from './types'
import { SqlSchema, SqlSelect, NativeSelectRow, SelectKeys } from './schema'


/** The live connection to a database.  Mutexes access, since Sqlite doesn't allow multi-threaded access. */
export class SqlightDatabase<TABLES extends Record<string, SchemaTable>> {
    private _db: Database | null = null
    private mutex: Mutex

    constructor(
        /** Database schema */
        public readonly schema: SqlSchema<TABLES>,
        /** Path to the database on disk */
        public readonly sqliteDatabasePath: Path,
    ) {
        this.mutex = new Mutex()
    }

    /**
     * Creates a temporary database, executing the given function with a handle to it.
     * Closes and deletes the database when the function exits, regardless of success or error.
     * Passes back the return value of the function.
     */
    static withTemporaryDatabase<TABLES extends Record<string, SchemaTable>, U>(schema: SqlSchema<TABLES>, f: (db: SqlightDatabase<TABLES>) => Promise<U>): Promise<U> {
        return Path.withTempFile(async (tempFile) => {
            const db = new SqlightDatabase(schema, tempFile)
            try {
                return await f(db)
            } finally {
                try {
                    await db.close()
                } catch { }
            }
        })
    }

    /** Gets a new SELECT-builder, which can then be executed against this database. */
    select() {
        return this.schema.select()
    }

    /**
     * Gets the database object, opening connection to the database if necessary.
     * 
     * **Must** be called inside the mutex!
     */
    private async db(): Promise<Database> {
        if (!this._db) {
            this._db = await open({
                filename: this.sqliteDatabasePath.absPath,
                driver: sqllite3.Database,
            })
            return this._db!
        }
        return this._db
    }

    /** Closes connection to the datbase, or does nothing if it's already closed. */
    close(): Promise<this> {
        return this.mutex.runExclusive(async () => {
            if (this._db) {
                await this._db.close()
                this._db = null
            }
            return this
        })
    }

    /** Runs arbitrary SQL as a statement, without a resultset, or does nothing if the statement is empty */
    async queryStatement(sql: string | D.Nullish): Promise<void> {
        if (D.NOT_EMPTY(sql)) {
            await this.mutex.runExclusive(async () => {
                const db = await this.db()
                return await db.exec(sql)
            })
        }
    }

    /** Runs an arbitrary query inside the mutex, loading all rows into memory at once. */
    queryAll<ROW extends Record<string, any>>(sql: string): Promise<ROW[]> {
        return this.mutex.runExclusive(async () => {
            const db = await this.db()
            return await db.all(sql)
        })
    }

    /** Runs an arbitrary query inside the mutex, returning the first row or `undefined` if no rows. */
    queryOne<ROW extends Record<string, any>>(sql: string): Promise<ROW | undefined> {
        return this.mutex.runExclusive(async () => {
            const db = await this.db()
            return await db.get<ROW>(sql)
        })
    }

    /** Runs an arbitrary query inside the mutex, returning a named column as an array. */
    async queryCol<COLNAME extends string, V>(sql: string, colName: COLNAME): Promise<V[]> {
        return (await this.queryAll<Record<COLNAME, V>>(sql)).map(row => row[colName])
    }

    /** Runs a query inside the mutex, loading all rows into memory at once. */
    selectAll<SELECT extends SqlSelect<TABLES>>(select: SELECT): Promise<NativeSelectRow<SELECT>[]> {
        return this.queryAll(select.toSql())
    }

    /** Runs a query inside the mutex, returning the first row or `undefined` if no rows. */
    selectOne<SELECT extends SqlSelect<TABLES>>(select: SELECT): Promise<NativeSelectRow<SELECT> | undefined> {
        // Limits to 1, since we're selecting only one!
        return this.queryOne(select.toSql({ limitMax: 1 }))
    }

    /** Runs a query inside the mutex, returning the data of the named column as an array. */
    selectCol<SELECT extends SqlSelect<TABLES>, COLNAME extends SelectKeys<SELECT>>(select: SELECT, colName: COLNAME): Promise<NativeSelectRow<SELECT>[COLNAME][]> {
        return this.queryCol(select.toSql(), colName)
    }

    /** Creates a table if it doesn't already exist, using the current schema. */
    createTable<TABLENAME extends keyof TABLES>(tableName: TABLENAME): Promise<void> {
        return this.queryStatement(this.schema.getCreateTableSql(tableName, true))
    }

    /** Runs `createTable()` on all tables in the schema, in order in case order matters. */
    async createTables(): Promise<void> {
        for (const name of D.KEYS(this.schema.schema.tables)) {
            await this.createTable(name)
        }
    }

    /** Inserts data into a table, or does nothing if the row-list is missing or empty. */
    insert<TABLENAME extends keyof TABLES>(tableName: TABLENAME, rows: NativeForRowColumns<TABLES[TABLENAME]["columns"]>[] | D.Nullish): Promise<void> {
        return this.queryStatement(this.schema.getInsertRowsSql(tableName, rows))
    }

    /** Updates rows with a subset of their columns, based on their primary keys, or does nothing if the row-list if missing or empty. */
    updateByPrimaryKey<TABLENAME extends keyof TABLES>(tableName: TABLENAME, rows: NativeUpdateForSchemaColumns<TABLES[TABLENAME]["columns"]>[] | D.Nullish): Promise<void> {
        return this.queryStatement(this.schema.getUpdateRowsByPkSql(tableName, rows))
    }

    /** Deletes rows based on their primary keys, or does nothing if the row-list if missing or empty. */
    deleteByPrimaryKey<TABLENAME extends keyof TABLES>(tableName: TABLENAME, rows: PrimaryKeyForSchemaColumns<TABLES[TABLENAME]["columns"]>[] | D.Nullish): Promise<void> {
        return this.queryStatement(this.schema.getDeleteRowsByPkSql(tableName, rows))
    }

    /** Gets the list of tables in the database, along with their raw SQL creation definitions. */
    async getTables(): Promise<{ name: string, sql: string }[]> {
        return this.queryAll("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
    }
}
