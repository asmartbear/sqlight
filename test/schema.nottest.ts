import * as S from "../src/expr"

const MySchema = {
    tables: {
        outline: {
            columns: {
                id: { type: 'TEXT', pk: true, },
                slug: { type: 'TEXT' },
                level: { type: 'INTEGER' },
                title: { type: 'TEXT' },
                summary: { type: 'TEXT', nullable: true },
                markdown: { type: 'TEXT' },
            },
        },
        embeddings: {
            columns: {
                id: { type: 'TEXT', pk: true, },
                category: { type: 'TEXT' },
                v: { type: 'BLOB' },
            }
        },
    }
} as const;


// test('select', () => {
//     const sel = new S.SqlSelect(MySchema)
//     sel.select(S.EXPR(1), "noop")
//     const t = sel.from.table('embeddings', 'e')
//     expect(sel.toSql()).toEqual(`SELECT 1 AS noop\nFROM "embeddings" e\n`)
//     sel.select(t.column('id').eq("foo"), "is_foo")
//     expect(sel.toSql()).toEqual(`SELECT 1 AS noop,\n       (e.id = 'foo') AS is_foo\nFROM "embeddings" e\n`)
//     sel.where(t.column('v').isNotNull())
//     expect(sel.toSql()).toEqual(`SELECT 1 AS noop,\n       (e.id = 'foo') AS is_foo\nFROM "embeddings" e\nWHERE  e.v IS NOT NULL\n`)
// })

// test('select with types', () => {
//     const sel = new S.SqlSelect(MySchema)
//     const out = sel.from.table('outline', 'o')
//     const r = sel.selectResult({
//         id: out.column('id'),
//         level: out.column('level').add(123),
//         calc: S.EXPR(1).add(2).add(3),
//     })
//     expect(sel.toSql()).toEqual(`SELECT o.id AS id,\n       (o.level + 123) AS level,\n       ((1 + 2) + 3) AS calc\nFROM "outline" o\n`)
// })