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
        await db.createTables()
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
            isAdmin: 1,
            login: "myname",
        } as const
        const r2 = {
            apiKey: null,
            id: 2,
            isAdmin: 0,
            login: "yourname",
        } as const
        const r3 = {
            apiKey: null,
            id: 3,
            isAdmin: 0,
            login: "else",
        } as const
        await db.insert('user', [r1, r2, r3])
        T.eq(await db.queryAll('SELECT * FROM user'), [r1, r2, r3])

        // Simple select query
        const base = db.select()
        const u = base.from('u', 'user').col
        let s = base
            .passThrough(u.id)
            .passThrough(u.isAdmin)
            .passThrough(u.login)
            .passThrough(u.apiKey)
            .orderBy(u.login, 'ASC')        // different from the insertion order
        T.eq(await db.selectAll(s), [r3, r1, r2])
        T.eq(await db.selectOne(s), r3)
        T.eq(await db.selectCol(s, 'id'), [3, 1, 2])
        T.eq(await db.selectCol(s, 'login'), ["else", "myname", "yourname"])

        // Update row data by pk
        await db.updateByPrimaryKey('user', [{
            id: 3,
            login: "another",
        }])
        T.eq(await db.selectOne(s), {
            ...r3,
            login: "another",
        })

        // No-op update
        await db.updateByPrimaryKey('user', [])
        await db.updateByPrimaryKey('user', undefined)

        // Add filter
        s = s.where(u.login.includes('name'))
        T.eq(await db.selectAll(s), [r1, r2])
        T.eq(await db.selectCol(s, 'login'), ["myname", "yourname"])

        // Delete a row by pk
        await db.deleteByPrimaryKey('user', [{ id: r2.id }])
        T.eq(await db.selectAll(s), [r1])

        // Close database now, so that when it's closed again, we test that closing twice doesn't matter
        await db.close()
    })
)
