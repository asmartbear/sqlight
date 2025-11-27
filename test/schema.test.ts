import * as T from "@asmartbear/testutil"
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

test('SELECT with no tables', () => {
    const select = testSchema.select()
    T.be(select.toSql(), "SELECT 1")
    select.select('foo', 'bar')
    T.be(select.toSql(), `SELECT 'bar' AS foo`)
})

test('SELECT with limit and offset', () => {
    const select = testSchema.select()
    T.be(select.toSql(), "SELECT 1")
    select.select('foo', 'bar')
    select.setLimit(10)
    T.be(select.toSql(), `SELECT 'bar' AS foo\nLIMIT 10`)
    select.setOffset(5)
    T.be(select.toSql(), `SELECT 'bar' AS foo\nLIMIT 10 OFFSET 5`)
})

test('SELECT with order by', () => {
    const select = testSchema.select()
    select.select('foo', 'bar')
    T.be(select.toSql(), `SELECT 'bar' AS foo`)
    select.orderBy('foo', 'ASC')
    T.be(select.toSql(), `SELECT 'bar' AS foo\nORDER BY 'foo' ASC`)
    select.orderBy('bar', 'DESC')
    T.be(select.toSql(), `SELECT 'bar' AS foo\nORDER BY 'foo' ASC, 'bar' DESC`)
    select.setLimit(10)
    T.be(select.toSql(), `SELECT 'bar' AS foo\nORDER BY 'foo' ASC, 'bar' DESC\nLIMIT 10`, "limit in the right order")
})

test('SELECT with single FROM', () => {
    const select = testSchema.select()
    const u = select.from("u", "user")

    const id = u.col.id
    T.be(id.columnName, "id")
    T.be(id.type, "INTEGER")
    T.be(id.canBeNull, false)
    T.be(id.toSql(), "u.id")

    const apiKey = u.col.apiKey
    T.be(apiKey.columnName, "apiKey")
    T.be(apiKey.type, "TEXT")
    T.be(apiKey.canBeNull, true)
    T.be(apiKey.toSql(), "u.apiKey")

    select.select('myId', u.col.id)
    select.passThrough(apiKey)
    select.select('super', CONCAT(u.col.login, "-taco"))
    T.be(select.toSql(), `SELECT u.id AS myId, u.apiKey AS apiKey, u.login||'-taco' AS super\nFROM user u`)
})

test('SELECT with simple JOIN', () => {
    const select = testSchema.select()
    const u1 = select.from("u1", "user")
    const u2 = select.from("u2", "user", 'JOIN', u2 => u2.col.login.eq(u1.col.login))
    select.select('dup_login', u2.col.login)
    T.be(select.toSql(), `SELECT u2.login AS dup_login\nFROM user u1 JOIN user u2 ON (u2.login=u1.login)`)
    // Add WHERE
    select.where(u1.col.id.ne(u2.col.id))
    T.be(select.toSql(), `SELECT u2.login AS dup_login\nFROM user u1 JOIN user u2 ON (u2.login=u1.login)\nWHERE u1.id!=u2.id`)
})

test('WHERE x IN (subquery)', () => {
    const subselect = testSchema.select().select('id', EXPR(123))
    T.be(subselect.toSql(), "SELECT 123 AS id")
    const sub = subselect.asSubquery('id')
    T.be(sub.canBeNull, true)
    const select = testSchema.select().select('title', EXPR('hi'))
    const inSub = EXPR(456).inSubquery(sub)
    T.be(inSub.canBeNull, false)
    T.be(inSub.toSql(false), "456 IN (SELECT 123 AS id)")
    T.be(inSub.toSql(true), "(456 IN (SELECT 123 AS id))")
    select.where(inSub)
    T.be(select.toSql(), `SELECT 'hi' AS title\nWHERE 456 IN (SELECT 123 AS id)`)
})

test('create table SQL', () => {
    T.eq(testSchema.getCreateTableSql('user', false), "CREATE TABLE user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )")
    T.eq(testSchema.getCreateTableSql('user', true), "CREATE TABLE IF NOT EXISTS user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )")
})

test('insert row SQL', () => {
    T.eq(testSchema.getInsertRowsSql("user", undefined), "")
    T.eq(testSchema.getInsertRowsSql("user", null), "")
    T.eq(testSchema.getInsertRowsSql("user", []), "")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: "a1b2c3d4",
        id: 123,
        isAdmin: true,
        login: "myname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname','a1b2c3d4',TRUE)")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: null,
        id: 123,
        isAdmin: true,
        login: "myname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname',NULL,TRUE)", "explicit null value")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: null,
        id: 123,
        isAdmin: true,
        login: "myname",
    }, {
        apiKey: null,
        id: 321,
        isAdmin: false,
        login: "yourname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname',NULL,TRUE),\n(321,'yourname',NULL,FALSE)", "multiple rows")
})