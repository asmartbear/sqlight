import * as T from "@asmartbear/testutil"
import { CONCAT, EXPR } from "../src/expr"
import { SCHEMA } from "../src/schema"

const testSchema = SCHEMA({
    tables: {
        user: {
            columns: {
                id: { type: 'INTEGER', pk: true },
                login: { type: 'TEXT', unique: true },
                apiKey: { type: 'TEXT', nullable: true },
                isAdmin: { type: 'BOOLEAN' },
            }
        },
        noPrimary: {
            columns: {
                foo: { type: 'TEXT', unique: true },
                bar: { type: 'INTEGER' },
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
    T.eq(testSchema.getCreateTableSql('user', false), "CREATE TABLE user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT UNIQUE NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )")
    T.eq(testSchema.getCreateTableSql('user', true), "CREATE TABLE IF NOT EXISTS user ( id INTEGER NOT NULL PRIMARY KEY, login TEXT UNIQUE NOT NULL, apiKey TEXT, isAdmin BOOLEAN NOT NULL )")
})

test('insert row SQL', () => {
    T.eq(testSchema.getInsertRowsSql("user", undefined), "")
    T.eq(testSchema.getInsertRowsSql("user", null), "")
    T.eq(testSchema.getInsertRowsSql("user", []), "")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: "a1b2c3d4",
        id: 123,
        isAdmin: 1,
        login: "myname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname','a1b2c3d4',1)")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: null,
        id: 123,
        isAdmin: 1,
        login: "myname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname',NULL,1)", "explicit null value")

    T.eq(testSchema.getInsertRowsSql("user", [{
        apiKey: null,
        id: 123,
        isAdmin: 1,
        login: "myname",
    }, {
        apiKey: null,
        id: 321,
        isAdmin: 0,
        login: "yourname",
    }]), "INSERT INTO user (id,login,apiKey,isAdmin) VALUES\n(123,'myname',NULL,1),\n(321,'yourname',NULL,0)", "multiple rows")
})

test('update row SQL, with all columns and partial columns', () => {
    T.eq(testSchema.getUpdateRowsByPkSql("user", undefined), "")
    T.eq(testSchema.getUpdateRowsByPkSql("user", null), "")
    T.eq(testSchema.getUpdateRowsByPkSql("user", []), "")

    T.eq(testSchema.getUpdateRowsByPkSql("user", [{
        apiKey: "a1b2c3d4",
        id: 123,
        isAdmin: 1,
        login: "myname",
    }]), "BEGIN TRANSACTION;\nUPDATE user SET apiKey='a1b2c3d4', isAdmin=1, login='myname' WHERE id=123;\nCOMMIT;")

    T.eq(testSchema.getUpdateRowsByPkSql("user", [{
        apiKey: null,
        id: 123,
        isAdmin: 1,
        login: "myname",
    }, {
        apiKey: null,
        id: 321,
        isAdmin: 0,
        login: "yourname",
    }]), "BEGIN TRANSACTION;\nUPDATE user SET apiKey=NULL, isAdmin=1, login='myname' WHERE id=123;\nUPDATE user SET apiKey=NULL, isAdmin=0, login='yourname' WHERE id=321;\nCOMMIT;")

    T.eq(testSchema.getUpdateRowsByPkSql("user", [{
        id: 123,
        isAdmin: 0,
        login: undefined,       // one field is set to undefined; another is just missing; both should be missing from the UPDATE
    }]), "BEGIN TRANSACTION;\nUPDATE user SET isAdmin=0 WHERE id=123;\nCOMMIT;")
})

test('update fails on tables without primary key', () => {
    T.throws(() => testSchema.getUpdateRowsByPkSql("noPrimary", [{
        foo: "123",
        bar: 321,
    }]))

})

test('delete row SQL, by primary key', () => {
    T.eq(testSchema.getDeleteRowsByPkSql("user", undefined), "")
    T.eq(testSchema.getDeleteRowsByPkSql("user", null), "")
    T.eq(testSchema.getDeleteRowsByPkSql("user", []), "")

    T.eq(testSchema.getDeleteRowsByPkSql("user", [{ id: 123 }]),
        "DELETE FROM user WHERE id IN (123)"
    )
    T.eq(testSchema.getDeleteRowsByPkSql("user", [{ id: 123 }, { id: 321 }]),
        "DELETE FROM user WHERE id IN (123,321)"
    )
    // Fails if the table doesn't have a primary key
    T.throws(() => testSchema.getDeleteRowsByPkSql("noPrimary", [{ foo: 123 }]))
})