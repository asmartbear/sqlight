import * as T from "@asmartbear/testutil"
import * as S from "../src/expr"

test('integers from INT', () => {
    const n = S.INT(123)
    T.be(n.type, "INTEGER")
    T.be(n.toSql(), "123")
    T.be(n.nullable, 'never')
    T.be(n.assertIsNumeric(), n)
    T.throws(() => n.assertIsBoolean())
    T.throws(() => n.assertIsText())
})

test('integers from EXPR', () => {
    const n = S.EXPR(123)
    T.be(n.type, "INTEGER")
    T.be(n.toSql(), "123")
    T.be(n.nullable, 'never')
    T.be(n.assertIsNumeric(), n)
    T.throws(() => n.assertIsBoolean())
    T.throws(() => n.assertIsText())
})

test('reals from FLOAT', () => {
    const n = S.FLOAT(1.23)
    T.be(n.type, "REAL")
    T.be(n.toSql(), "1.23")
    T.be(n.nullable, 'never')
    T.be(n.assertIsNumeric(), n)
    T.throws(() => n.assertIsBoolean())
    T.throws(() => n.assertIsText())
})

test('reals from EXPR', () => {
    const n = S.EXPR(1.23)
    T.be(n.type, "REAL")
    T.be(n.toSql(), "1.23")
    T.be(n.nullable, 'never')
    T.be(n.assertIsNumeric(), n)
    T.throws(() => n.assertIsBoolean())
    T.throws(() => n.assertIsText())
})

test('strings', () => {
    const s = S.EXPR("foo")
    T.be(s.type, "TEXT")
    T.be(s.toSql(), "'foo'")
    T.be(s.nullable, 'never')
    T.be(s.assertIsText(), s)
    T.throws(() => s.assertIsBoolean())
    T.throws(() => s.assertIsNumeric())
})

test('booleans', () => {
    const s = S.EXPR(true)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(), "1")
    T.be(s.nullable, 'never')
    T.be(S.EXPR(false).toSql(), "0")
    T.be(S.EXPR(true).toSql(), "1")
    T.be(s.assertIsBoolean(), s)
    T.throws(() => s.assertIsNumeric())
    T.throws(() => s.assertIsText())
})

test('dates', () => {
    const s = S.EXPR(new Date(1234567890123))
    T.be(s.type, "TIMESTAMP")
    T.be(s.toSql(), "2009-02-13T23:31:30.123Z")
    T.be(s.nullable, 'never')
    T.throws(() => s.assertIsBoolean())
    T.throws(() => s.assertIsNumeric())
    T.throws(() => s.assertIsText())
})

test('blobs', () => {
    const s = S.EXPR(Buffer.from("hello", "utf8"))
    T.be(s.type, "BLOB")
    T.be(s.toSql(), "x'68656c6c6f'")
    T.be(s.nullable, 'never')
    T.throws(() => s.assertIsBoolean())
    T.throws(() => s.assertIsNumeric())
    T.throws(() => s.assertIsText())
})

test('invalid literal', () => {
    T.throws(() => S.EXPR(undefined as any))
    T.throws(() => S.EXPR([] as any))
    T.throws(() => S.EXPR([1, 2, 3] as any))
    T.throws(() => S.EXPR({} as any))
    T.throws(() => S.EXPR({ foo: 1 } as any))
})

test('literal with type', () => {
    T.be(S.LITERAL('BOOLEAN', 0).toSql(false), "0")
    T.be(S.LITERAL('BOOLEAN', 1).toSql(false), "1")
    T.be(S.LITERAL('BOOLEAN', false).toSql(false), "0")
    T.be(S.LITERAL('BOOLEAN', true).toSql(false), "1")
    T.be(S.LITERAL('INTEGER', 123).toSql(false), "123")
    T.be(S.LITERAL('REAL', 123).toSql(false), "123")
    T.be(S.LITERAL('TEXT', 'foo').toSql(false), "'foo'")
    T.be(S.LITERAL('VARCHAR', 'foo').toSql(false), "'foo'")
    T.be(S.LITERAL('TIMESTAMP', new Date(1234567890123)).toSql(false), "2009-02-13T23:31:30.123Z")
    T.be(S.LITERAL('BLOB', Buffer.from("hi")).toSql(false), "x'6869'")
    // typed NULL
    T.be(S.LITERAL('BOOLEAN', undefined).toSql(false), "NULL")
    T.be(S.LITERAL('BOOLEAN', null).toSql(false), "NULL")
    T.be(S.LITERAL('TEXT', null).toSql(false), "NULL")
    T.be(S.LITERAL('TEXT', null).type, "TEXT")
    T.be(S.LITERAL('INTEGER', undefined).toSql(false), "NULL")
    T.be(S.LITERAL('INTEGER', undefined).type, "INTEGER")
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
    T.be(s.nullable, 'never')

    s = S.EXPR("foo").ne("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'!='bar'")
    T.be(s.toSql(true), "('foo'!='bar')")
    T.be(s.nullable, 'never')

    s = S.EXPR("foo").lt("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'<'bar'")
    T.be(s.toSql(true), "('foo'<'bar')")
    T.be(s.nullable, 'never')

    s = S.EXPR("foo").le("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'<='bar'")
    T.be(s.toSql(true), "('foo'<='bar')")
    T.be(s.nullable, 'never')

    s = S.EXPR(321).gt(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321>123")
    T.be(s.toSql(true), "(321>123)")
    T.be(s.nullable, 'never')

    s = S.EXPR(321).ge(123)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "321>=123")
    T.be(s.toSql(true), "(321>=123)")
    T.be(s.nullable, 'never')
})

test('comparison with null', () => {
    let s = S.EXPR("foo").eq(S.LITERAL('TEXT', null))
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo'=NULL")
    T.be(s.toSql(true), "('foo'=NULL)")
    T.be(s.nullable, 'sometimes')

    s = S.LITERAL('TEXT', null).eq("foo")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "NULL='foo'")
    T.be(s.toSql(true), "(NULL='foo')")
    T.be(s.nullable, 'sometimes')
})

test('add/sub/mul', () => {
    for (const op of [{
        op: '+', f: (lhs: number | string, rhs: number) => S.EXPR(lhs).add(rhs),
    }, {
        op: '-', f: (lhs: number | string, rhs: number) => S.EXPR(lhs).sub(rhs),
    }, {
        op: '*', f: (lhs: number | string, rhs: number) => S.EXPR(lhs).mul(rhs),
    }]) {
        let s = op.f(123, 456)
        T.be(s.type, "INTEGER")
        T.be(s.toSql(false), `123${op.op}456`)
        T.be(s.toSql(true), `(123${op.op}456)`)
        T.be(s.nullable, 'never')

        s = op.f(123, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `123${op.op}4.56`)
        T.be(s.toSql(true), `(123${op.op}4.56)`)
        T.be(s.nullable, 'never')

        s = op.f(1.23, 456)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23${op.op}456`)
        T.be(s.toSql(true), `(1.23${op.op}456)`)
        T.be(s.nullable, 'never')

        s = op.f(1.23, 4.56)
        T.be(s.type, "REAL")
        T.be(s.toSql(false), `1.23${op.op}4.56`)
        T.be(s.toSql(true), `(1.23${op.op}4.56)`)
        T.be(s.nullable, 'never')

        T.throws(() => op.f('foo', 123))
    }
})


test('div', () => {
    let s = S.EXPR(123).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123/456")
    T.be(s.toSql(true), "(123/456)")
    T.be(s.nullable, 'never')

    s = S.EXPR(123).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "123/4.56")
    T.be(s.toSql(true), "(123/4.56)")
    T.be(s.nullable, 'never')

    s = S.EXPR(1.23).div(456)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23/456")
    T.be(s.toSql(true), "(1.23/456)")
    T.be(s.nullable, 'never')

    s = S.EXPR(1.23).div(4.56)
    T.be(s.type, "REAL")
    T.be(s.toSql(false), "1.23/4.56")
    T.be(s.toSql(true), "(1.23/4.56)")
    T.be(s.nullable, 'never')

    T.throws(() => S.EXPR("foo").div(123), undefined, "lhs must be numeric")
})

test('not', () => {
    const s = S.EXPR(false).not()
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "NOT (0)")
    T.be(s.toSql(true), "(NOT (0))")
    T.be(s.nullable, 'never')
})

test('is null', () => {
    const s = S.EXPR("foo").isNull()
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IS NULL")
    T.be(s.toSql(true), "'foo' IS NULL")
    T.be(s.nullable, 'never')
})

test('is not null', () => {
    const s = S.EXPR("foo").isNotNull()
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IS NOT NULL")
    T.be(s.toSql(true), "'foo' IS NOT NULL")
    T.be(s.nullable, 'never')
})

test('in list', () => {
    const s = S.EXPR("foo").inList(["foo", "bar", "123"])
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "'foo' IN('foo','bar','123')")
    T.be(s.toSql(true), "('foo' IN('foo','bar','123'))")
    T.be(s.nullable, 'never')
})

test('coalesce without nulls', () => {
    let s = S.COALESCE("foo", "bar")
    T.be(s.type, "TEXT")
    T.be(s.toSql(false), "COALESCE('foo','bar')")
    T.be(s.toSql(true), "COALESCE('foo','bar')")
    T.be(s.nullable, 'never')
})

test('coalesce of nulls', () => {
    let s = S.COALESCE(S.LITERAL('BOOLEAN', null), S.LITERAL('BOOLEAN', null))
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "COALESCE(NULL,NULL)")
    T.be(s.nullable, 'sometimes')
})

test('concat', () => {
    let s = S.CONCAT("foo", "bar", "baz")
    T.be(s.type, "TEXT")
    T.be(s.toSql(false), "'foo'||'bar'||'baz'")
    T.be(s.toSql(true), "('foo'||'bar'||'baz')")
    T.be(s.nullable, 'never')
})

test('includes', () => {
    let s = S.EXPR("foobar").includes("bar")
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), "INSTR('foobar','bar')")
    T.be(s.toSql(true), "INSTR('foobar','bar')")
    T.be(s.nullable, 'never')
    T.throws(() => S.EXPR(123).includes("bar"), undefined, "lhs must be a string")
})

test('and/or (and multi-nary operators generally)', () => {
    const TRUE = S.LITERAL('BOOLEAN', 1)
    const FALSE = S.LITERAL('BOOLEAN', 0)

    // Binary
    for (const op of [{
        op: 'AND', f: (lhs: boolean | string, rhs: boolean) => S.EXPR(lhs).and(rhs ? TRUE : FALSE),
    }, {
        op: 'OR', f: (lhs: boolean | string, rhs: boolean) => S.EXPR(lhs).or(rhs ? TRUE : FALSE),
    }]) {
        let s = op.f(true, false)
        T.be(s.type, "BOOLEAN")
        T.be(s.toSql(false), `1 ${op.op} 0`)
        T.be(s.toSql(true), `(1 ${op.op} 0)`)
        T.be(s.nullable, 'never')
        T.throws(() => op.f('foo', true))
    }

    // Nested
    let s = S.OR(S.AND(TRUE, FALSE), TRUE, FALSE)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `(1 AND 0) OR 1 OR 0`)
    T.be(s.toSql(true), `((1 AND 0) OR 1 OR 0)`)
    T.be(s.nullable, 'never')

    // Degenerate
    s = S.AND(TRUE)
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `1`)
    T.be(s.toSql(true), `1`)
    T.be(s.nullable, 'never')

    // Degenerate nested
    s = S.AND(S.OR(TRUE, FALSE))
    T.be(s.type, "BOOLEAN")
    T.be(s.toSql(false), `1 OR 0`)
    T.be(s.toSql(true), `(1 OR 0)`)
    T.be(s.nullable, 'never')
})

test('case', () => {
    let s = S.CASE<'INTEGER'>([[S.EXPR('foo').eq('a'), 1], [S.EXPR('foo').eq('b'), 2]])
    T.be(s.type, "INTEGER")
    T.be(s.toSql(false), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 END")
    T.be(s.toSql(true), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 END")
    T.be(s.nullable, 'sometimes', "because there's no ELSE")

    s = S.CASE<'INTEGER'>([[S.EXPR('foo').eq('a'), 1], [S.EXPR('foo').eq('b'), 2]], -1)
    T.be(s.type, "INTEGER")
    T.be(s.toSql(false), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 ELSE -1 END")
    T.be(s.toSql(true), "CASE WHEN 'foo'='a' THEN 1 WHEN 'foo'='b' THEN 2 ELSE -1 END")
    T.be(s.nullable, 'never', "because all components are never-null")
})
