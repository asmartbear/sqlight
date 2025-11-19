import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

import { invariant } from './invariant';
import { Nullish, SqlType, NativeFor, SchemaColumn, SchemaTable, SchemaDatabase } from './types'
import { SqlExpression, SqlInputValue, EXPR, AND } from './expr'


/** The live connection to a database. */
export class SqlightDatabase {
    private _db: Database | null = null

    constructor(
        /** Path to the database on disk */
        public readonly path: string
    ) {
    }

    /** Gets the database object, opening connection to the database if necessary */
    async db(): Promise<Database> {
        if (!this._db) {
            await this.open()
            return this._db!
        }
        return this._db
    }

    /** Opens connection to the database, or does nothing if it's already open. */
    async open(): Promise<this> {
        if (!this._db) {
            this._db = await open({
                filename: this.path,
                driver: sqlite3.Database,
            })
        }
        return this
    }

    /** Closes connection to the datbase, or does nothing if it's already closed. */
    async close(): Promise<this> {
        if (this._db) {
            await this._db.close()
            this._db = null
        }
        return this
    }

    /** Gets the list of tables in the database, along with their raw SQL creation definition. */
    async getTables(): Promise<{ name: string, sql: string }[]> {
        const db = await this.db()
        return db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
    }
}

// (async () => {
//     const BEARDB_SQLITE = `${process.env.HOME}/Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data/database.sqlite`
//     const db = new SqlightDatabase(BEARDB_SQLITE)
//     const result = await db.getTables()
//     await db.close()
//     return result
// })().then(console.log)