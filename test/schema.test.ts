import * as T from "./testutil"
import { SchemaDatabase } from "../src/types"
import { CONCAT, EXPR } from "../src/expr"
import { SCHEMA } from "../src/schema"

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

test('schema columns', () => {
    const table = testSchema.from("user", "u")

    const id = table.col.id
    T.be(id.columnName, "id")
    T.be(id.type, "INTEGER")
    T.be(id.canBeNull(), false)
    T.be(id.toSql(), "u.id")

    const apiKey = table.col.apiKey
    T.be(apiKey.columnName, "apiKey")
    T.be(apiKey.type, "TEXT")
    T.be(apiKey.canBeNull(), true)
    T.be(apiKey.toSql(), "u.apiKey")
})

test('select with pure expressions', () => {
    const select = testSchema.select()
    T.be(select.toSql(), "SELECT 1")
    select.select('foo', 'bar')
    T.be(select.toSql(), `SELECT 'bar' AS foo`)
})

test('select with single from', () => {
    const select = testSchema.select()
    const u = select.from("user", "u")
    select.select('myId', u.col.id)
    select.select('super', CONCAT(u.col.login, "-taco"))
    T.be(select.toSql(), `SELECT u.id AS myId, u.login || '-taco' AS super\nFROM user u`)
})