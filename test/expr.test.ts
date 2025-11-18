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
    T.be(S.EXPR(false).toSql(), "FALSE")
})

test('blobs', () => {
    const s = S.EXPR(Buffer.from("hello", "utf8"))
    T.be(s.type, "BLOB")
    T.be(s.toSql(), "x'68656c6c6f'")
    T.be(s.canBeNull(), false)
})

test('invalid literal', () => {
    T.throws(() => S.EXPR(undefined as any))
    T.throws(() => S.EXPR([] as any))
    T.throws(() => S.EXPR([1, 2, 3] as any))
    T.throws(() => S.EXPR({} as any))
    T.throws(() => S.EXPR({ foo: 1 } as any))
})

test('comparisons', () => {
    let s = S.EXPR("foo").eq("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' = 'bar'")
    T.be(s.toSql(true), "('foo' = 'bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").ne("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' != 'bar'")
    T.be(s.toSql(true), "('foo' != 'bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").lt("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' < 'bar'")
    T.be(s.toSql(true), "('foo' < 'bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").le("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' <= 'bar'")
    T.be(s.toSql(true), "('foo' <= 'bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR(321).gt(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321 > 123")
    T.be(s.toSql(true), "(321 > 123)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(321).ge(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321 >= 123")
    T.be(s.toSql(true), "(321 >= 123)")
    T.be(s.canBeNull(), false)
})

test('add/sub/mul', () => {

    for (const op of [{
        op: '+', f: (lhs: number, rhs: number) => S.EXPR(lhs).add(rhs),
    }, {
        op: '-', f: (lhs: number, rhs: number) => S.EXPR(lhs).sub(rhs),
    }, {
        op: '*', f: (lhs: number, rhs: number) => S.EXPR(lhs).mul(rhs),
    }]) {
        let s = op.f(123, 456)
        T.be(s.type, "INTEGER")
        T.be(s.toSql(false), `123 ${op.op} 456`)
        T.be(s.toSql(true), `(123 ${op.op} 456)`)
        T.be(s.canBeNull(), false)

        s = op.f(123, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `123 ${op.op} 4.56`)
        T.be(s.toSql(true), `(123 ${op.op} 4.56)`)
        T.be(s.canBeNull(), false)

        s = op.f(1.23, 456)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23 ${op.op} 456`)
        T.be(s.toSql(true), `(1.23 ${op.op} 456)`)
        T.be(s.canBeNull(), false)

        s = op.f(1.23, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23 ${op.op} 4.56`)
        T.be(s.toSql(true), `(1.23 ${op.op} 4.56)`)
        T.be(s.canBeNull(), false)
    }
})


test('div', () => {
    let s = S.EXPR(123).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123 / 456")
    T.be(s.toSql(true), "(123 / 456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(123).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123 / 4.56")
    T.be(s.toSql(true), "(123 / 4.56)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23 / 456")
    T.be(s.toSql(true), "(1.23 / 456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23 / 4.56")
    T.be(s.toSql(true), "(1.23 / 4.56)")
    T.be(s.canBeNull(), false)
})

test('is null', () => {
    const s = S.EXPR("foo").isNull()
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IS NULL")
    T.be(s.toSql(true), "'foo' IS NULL")
    T.be(s.canBeNull(), false)
})

test('is not null', () => {
    const s = S.EXPR("foo").isNotNull()
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IS NOT NULL")
    T.be(s.toSql(true), "'foo' IS NOT NULL")
    T.be(s.canBeNull(), false)
})

test('in list', () => {
    const s = S.EXPR("foo").inList(["foo", "bar", "123"])
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IN ('foo','bar','123')")
    T.be(s.toSql(true), "('foo' IN ('foo','bar','123'))")
    T.be(s.canBeNull(), false)
})

test('coalesce', () => {
    let s = S.COALESCE("foo", "bar")
    T.be(s.type, "TEXT")
    T.be(s.toSql(false), "COALESCE('foo','bar')")
    T.be(s.toSql(true), "COALESCE('foo','bar')")
    T.be(s.canBeNull(), false)
})
