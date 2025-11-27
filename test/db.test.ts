import * as T from "@asmartbear/testutil"
import { EXPR } from "../src/expr"
import { SCHEMA } from "../src/schema"
import { SqlightDatabase } from "../src/db"

const testSchema = SCHEMA({
    tables: {
        user: {
            columns: {
                id: { type: 'INTEGER', pk: true },
                login: { type: 'TEXT' },
                apiKey: { type: 'TEXT', nullable: true },
                isAdmin: { type: 'BOOLEAN' },
            }
        }
    }
})

test('empty database; basic queries anyway', async () =>
    SqlightDatabase.withTemporaryDatabase(testSchema, async (db) => {
        T.eq(await db.queryAll('SELECT 1 AS foo'), [{ foo: 1 }])
        T.eq(await db.queryOne('SELECT 1 AS foo'), { foo: 1 })
        T.eq(await db.queryCol('SELECT 1 AS foo', 'foo'), [1])
    })
)

test('create and query a simple table', async () =>
    SqlightDatabase.withTemporaryDatabase(testSchema, async (db) => {
        // Create table
        T.eq(await db.getTables(), [], "empty database")
        await db.createTable('user')
        T.eq(await db.getTables(), [{
            name: "user",
            sql: "CREATE TABLE user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )"
        }])
        // Creating again doesn't error because of "if not exist"
        await db.createTable('user')
        T.eq(await db.getTables(), [{
            name: "user",
            sql: "CREATE TABLE user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )"
        }])
        // Nothing in the table
        T.eq(await db.queryAll('SELECT * FROM user'), [])
        // Insert some rows
        const r1 = {
            apiKey: "a1b2c3d4",
            id: 1,
            isAdmin: true,
            login: "myname",
        }
        const r2 = {
            apiKey: null,
            id: 2,
            isAdmin: false,
            login: "yourname",
        }
        await db.insert('user', [r1, r2])
        T.eq(await db.queryAll('SELECT * FROM user'), [r1, r2])
    })
)
