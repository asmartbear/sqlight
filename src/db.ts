import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Mutex } from 'async-mutex';

import { invariant } from './invariant';
import { Nullish, SqlType, NativeFor, SchemaColumn, SchemaTable, SchemaDatabase, RowColumns, NativeForRowColumns, Flatten } from './types'
import { SqlExpression, SqlInputValue, EXPR, AND } from './expr'
import { SqlSchema, SqlSelect, NativeSelectRow } from './schema'


/** The live connection to a database.  Mutexes access, since Sqlite doesn't allow multi-threaded access. */
export class SqlightDatabase<TABLES extends Record<string, SchemaTable>> {
    private _db: Database | null = null
    private mutex: Mutex

    constructor(
        /** Database schema */
        public readonly schema: SqlSchema<TABLES>,
        /** Path to the database on disk */
        public readonly path: string,
    ) {
        this.mutex = new Mutex()
    }

    /** Gets a new SELECT-builder, which can then be executed against this database. */
    select() {
        return this.schema.select()
    }

    /** Gets the database object, opening connection to the database if necessary */
    private async db(): Promise<Database> {
        if (!this._db) {
            await this.open()
            return this._db!
        }
        return this._db
    }

    /** Opens connection to the database, or does nothing if it's already open. */
    private async open(): Promise<this> {
        if (!this._db) {
            this._db = await open({
                filename: this.path,
                driver: sqlite3.Database,
            })
        }
        return this
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

    /** Runs an arbitrary query inside the mutex, loading all rows into memory at once. */
    queryAll<ROW extends Record<string, any>>(sql: string): Promise<ROW[]> {
        return this.mutex.runExclusive(async () => {
            const db = await this.db()
            return db.all(sql)
        })
    }

    /** Runs an arbitrary query inside the mutex, returning the first row or `undefined` if no rows. */
    queryOne<ROW extends Record<string, any>>(sql: string): Promise<ROW | undefined> {
        return this.mutex.runExclusive(async () => {
            const db = await this.db()
            return db.get<ROW>(sql)
        })
    }

    /** Runs a query inside the mutex, loading all rows into memory at once. */
    selectAll<SELECT extends SqlSelect<TABLES>>(select: SELECT): Promise<NativeSelectRow<typeof select>[]> {
        return this.queryAll(select.toSql())
    }

    /** Runs a query inside the mutex, returning the first row or `undefined` if no rows. */
    selectOne<SELECT extends SqlSelect<TABLES>>(select: SELECT): Promise<NativeSelectRow<typeof select> | undefined> {
        return this.queryOne(select.toSql())
    }

    /** Gets the list of tables in the database, along with their raw SQL creation definitions. */
    async getTables(): Promise<{ name: string, sql: string }[]> {
        return this.queryAll("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
    }
}
