import * as T from "./testutil"
import * as S from "../src/expr"

test('integers from INT', () => {
    const n = S.INT(123)
    T.be(n.type, "INTEGER")
    T.be(n.toSql(), "123")
    T.be(n.canBeNull(), false)
})

test('integers from EXPR', () => {
    const n = S.EXPR(123)
    T.be(n.type, "INTEGER")
    T.be(n.toSql(), "123")
    T.be(n.canBeNull(), false)
})

test('reals from FLOAT', () => {
    const n = S.FLOAT(1.23)
    T.be(n.type, "REAL")
    T.be(n.toSql(), "1.23")
    T.be(n.canBeNull(), false)
})

test('reals from EXPR', () => {
    const n = S.EXPR(1.23)
    T.be(n.type, "REAL")
    T.be(n.toSql(), "1.23")
    T.be(n.canBeNull(), false)
})

test('strings', () => {
    const s = S.EXPR("foo")
    T.be(s.type, "TEXT")
    T.be(s.toSql(), "'foo'")
    T.be(s.canBeNull(), false)
})

test('booleans', () => {
    const s = S.EXPR(true)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(), "TRUE")
    T.be(s.canBeNull(), false)
})

test('equal', () => {
    const s = S.EXPR("foo").eq("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' = 'bar'")
    T.be(s.toSql(true), "('foo' = 'bar')")
    T.be(s.canBeNull(), false)
})

test('add', () => {
    let s = S.EXPR(123).add(456)
    T.be(s.type, "INTEGER")
    T.be(s.toSql(false), "123 + 456")
    T.be(s.toSql(true), "(123 + 456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(123).add(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123 + 4.56")
    T.be(s.toSql(true), "(123 + 4.56)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).add(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23 + 456")
    T.be(s.toSql(true), "(1.23 + 456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).add(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23 + 4.56")
    T.be(s.toSql(true), "(1.23 + 4.56)")
    T.be(s.canBeNull(), false)
})

test('in list', () => {
    const s = S.EXPR("foo").inList(["foo", "bar", "123"])
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IN ('foo','bar','123')")
    T.be(s.toSql(true), "('foo' IN ('foo','bar','123'))")
    T.be(s.canBeNull(), false)
})
