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

test('TYPE', () => {
    T.be(S.TYPE(S.EXPR(123)), "INTEGER")
    T.be(S.TYPE(S.EXPR(12.3)), "REAL")
    T.be(S.TYPE(S.EXPR("foo")), "TEXT")
    T.be(S.TYPE(S.EXPR(false)), "BOOLEAN")
    T.be(S.TYPE(), undefined)
    T.be(S.TYPE(undefined, S.EXPR(123)), "INTEGER")
    T.be(S.TYPE(S.EXPR(123), undefined), "INTEGER")
    T.be(S.TYPE([undefined, undefined]), undefined)
    T.be(S.TYPE([undefined, S.EXPR(123)]), "INTEGER")
    T.be(S.TYPE([S.EXPR(123), undefined]), "INTEGER")
})

test('comparisons', () => {
    let s = S.EXPR("foo").eq("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'='bar'")
    T.be(s.toSql(true), "('foo'='bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").ne("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'!='bar'")
    T.be(s.toSql(true), "('foo'!='bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").lt("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'<'bar'")
    T.be(s.toSql(true), "('foo'<'bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR("foo").le("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'<='bar'")
    T.be(s.toSql(true), "('foo'<='bar')")
    T.be(s.canBeNull(), false)

    s = S.EXPR(321).gt(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321>123")
    T.be(s.toSql(true), "(321>123)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(321).ge(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321>=123")
    T.be(s.toSql(true), "(321>=123)")
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
        T.be(s.toSql(false), `123${op.op}456`)
        T.be(s.toSql(true), `(123${op.op}456)`)
        T.be(s.canBeNull(), false)

        s = op.f(123, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `123${op.op}4.56`)
        T.be(s.toSql(true), `(123${op.op}4.56)`)
        T.be(s.canBeNull(), false)

        s = op.f(1.23, 456)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23${op.op}456`)
        T.be(s.toSql(true), `(1.23${op.op}456)`)
        T.be(s.canBeNull(), false)

        s = op.f(1.23, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23${op.op}4.56`)
        T.be(s.toSql(true), `(1.23${op.op}4.56)`)
        T.be(s.canBeNull(), false)
    }
})


test('div', () => {
    let s = S.EXPR(123).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123/456")
    T.be(s.toSql(true), "(123/456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(123).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123/4.56")
    T.be(s.toSql(true), "(123/4.56)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23/456")
    T.be(s.toSql(true), "(1.23/456)")
    T.be(s.canBeNull(), false)

    s = S.EXPR(1.23).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23/4.56")
    T.be(s.toSql(true), "(1.23/4.56)")
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

test('concat', () => {
    let s = S.CONCAT("foo", "bar", "baz")
    T.be(s.type, "TEXT")
    T.be(s.toSql(false), "'foo'||'bar'||'baz'")
    T.be(s.toSql(true), "('foo'||'bar'||'baz')")
    T.be(s.canBeNull(), false)
})

test('and/or (and multi-nary operators generally)', () => {
    // Binary
    for (const op of [{
        op: 'AND', f: (lhs: boolean, rhs: boolean) => S.BOOL(lhs).and(rhs),
    }, {
        op: 'OR', f: (lhs: boolean, rhs: boolean) => S.BOOL(lhs).or(rhs),
    }]) {
        let s = op.f(true, false)
        T.be(s.type, "BOOLEAN")
        T.be(s.toSql(false), `TRUE ${op.op} FALSE`)
        T.be(s.toSql(true), `(TRUE ${op.op} FALSE)`)
        T.be(s.canBeNull(), false)
    }

    // Nested
    let s = S.OR(S.AND(true, false), true, false)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `(TRUE AND FALSE) OR TRUE OR FALSE`)
    T.be(s.toSql(true), `((TRUE AND FALSE) OR TRUE OR FALSE)`)
    T.be(s.canBeNull(), false)

    // Degenerate
    s = S.AND(true)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `TRUE`)
    T.be(s.toSql(true), `TRUE`)
    T.be(s.canBeNull(), false)

    // Degenerate nested
    s = S.AND(S.OR(true, false))
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `TRUE OR FALSE`)
    T.be(s.toSql(true), `(TRUE OR FALSE)`)
    T.be(s.canBeNull(), false)
})

test('case', () => {
    let s = S.CASE<'INTEGER'>([[S.EXPR('foo').eq('a'), 1], [S.EXPR('foo').eq('b'), 2]])
    T.be(s.type, "INTEGER")
    T.be(s.toSql(false), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 END")
    T.be(s.toSql(true), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 END")
    T.be(s.canBeNull(), true, "because there's no ELSE")

    s = S.CASE<'INTEGER'>([[S.EXPR('foo').eq('a'), 1], [S.EXPR('foo').eq('b'), 2]], -1)
    T.be(s.type, "INTEGER")
    T.be(s.toSql(false), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 ELSE -1 END")
    T.be(s.toSql(true), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 ELSE -1 END")
    T.be(s.canBeNull(), false)
})
