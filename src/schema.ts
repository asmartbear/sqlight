import { invariant } from './invariant';
import { Nullish, SqlType, NativeFor, SchemaColumn, SchemaTable, SchemaDatabase } from './types'
import { SqlExpression, SqlInputValue, EXPR } from './expr'

/** Converts a static schema into something Typescript understands in detail */
export function SCHEMA<TABLES extends Record<string, SchemaTable>>(schema: SchemaDatabase<TABLES>): SqlSchema<TABLES> {
    return new SqlSchema(schema)
}

/**
 * Holds functions that are global to an entire schema.
 */
export class SqlSchema<TABLES extends Record<string, SchemaTable>> {
    constructor(
        public readonly schema: SchemaDatabase<TABLES>,
    ) { }

    /** Starts a new SELECT expression. */
    select() {
        return new SqlSelect(this)
    }

    /**
     * Creates a table for a "from" clause, wrapping a table with an alias.
     */
    from<TABLENAME extends keyof TABLES, TALIAS extends string>(tableName: TABLENAME, alias: TALIAS) {
        return new SqlFromTable(this.schema.tables, tableName, alias)
    }
}

/** A reference to a table with an alias. */
class SqlFromTable<
    TABLES extends Record<string, SchemaTable>,
    TABLENAME extends keyof TABLES,
    TALIAS extends string
> {
    public readonly table

    /** SQL expressions for columns in this table. */
    public readonly col: { [K in keyof TABLES[TABLENAME]["columns"] & string]: SqlColumn<K, TABLES[TABLENAME]["columns"][K]> }

    constructor(
        tables: TABLES,
        public readonly tableName: TABLENAME,
        public readonly alias: TALIAS,
    ) {
        this.table = tables[tableName]
        this.col = Object.fromEntries(
            Object.entries(tables[tableName].columns).map(
                ([field, col]) => [field, new SqlColumn(this.alias, field, col)]
            )
        ) as any
    }
}

/** SQL expression for a column in an aliased table. */
class SqlColumn<
    COLNAME extends string,
    COLUMN extends SchemaColumn,
> extends SqlExpression<COLUMN['type']> {

    constructor(
        public readonly tableAlias: string,
        public readonly columnName: COLNAME,
        public readonly column: COLUMN,
    ) {
        super(column.type)
    }

    canBeNull(): boolean { return !!this.column.nullable }

    toSql() { return `${this.tableAlias}.${this.columnName}` }
}

/** A SQL select expression. */
class SqlSelect<TABLES extends Record<string, SchemaTable>> {

    private readonly selectSql = new Map<string, SqlExpression<SqlType>>()
    private readonly fromTables = new Map<string, SqlFromTable<TABLES, string, string>>()

    constructor(
        public readonly schema: SqlSchema<TABLES>
    ) {

    }

    /** Sets a select clause of a given aliased name with a SQL expression, or replaces a previous one. */
    select(alias: string, sql: SqlInputValue<SqlType>) {
        this.selectSql.set(alias, EXPR(sql))
    }

    /**
     * Creates a table for a "from" clause, wrapping a table with an alias.
     */
    from<TABLENAME extends keyof TABLES, TALIAS extends string>(tableName: TABLENAME, alias: TALIAS) {
        const t = new SqlFromTable(this.schema.schema.tables, tableName, alias)
        this.fromTables.set(alias, t as any)
        return t
    }

    toSql(): string {
        const clauses = Array.from(this.selectSql.entries())
        if (clauses.length == 0) return 'SELECT 1'        // corner case

        // SELECT
        let pieces: string[] = []
        pieces.push(
            'SELECT ' + clauses.map(
                ([alias, expr]) => `${expr.toSql(false)} AS ${alias}`
            ).join(', ')
        )

        // FROM
        if (this.fromTables.size) {
            const tableSql = Array.from(this.fromTables.values()).map(
                t => `${t.tableName} ${t.alias}`
            )
            pieces.push('FROM ' + tableSql.join(', '))
        }

        // done
        return pieces.join('\n')
    }
}

/** A 'from' clause, with aliased tables and joins. */
// export class SqlFrom<S extends SchemaDatabase> {
//     private readonly froms: SqlFromTable<S, string, string>[] = []

//     constructor(
//         public readonly schema: S
//     ) { }

//     /**
//      * Adds a table to the `FROM` clause, returning it.
//      */
//     table<TABLE extends string & keyof S['tables'], TALIAS extends string>(tableName: TABLE, alias: TALIAS): SqlFromTable<S, TABLE, TALIAS> {
//         const table = new SqlFromTable(this.schema, tableName, alias)
//         this.froms.push(table)
//         return table
//     }

//     toSql() {
//         return 'FROM ' + this.froms.map(from => `"${from.tableName}" ${from.alias}`).join(', ') + "\n"
//     }
// }

/**
 * A 'SELECT' clause, with subclauses.
 */
// export class SqlSelect<S extends SchemaDatabase> {
//     private readonly selects = new Map<string, SqlExpression<any>>()
//     public readonly from: SqlFrom<S>
//     private readonly wheres: SqlExpression<'BOOLEAN'>[] = []

//     constructor(
//         public readonly schema: S,
//     ) {
//         this.from = new SqlFrom(schema)
//     }

//     /**
//      * Add/replace one expression in the `SELECT` clause.
//      */
//     select(ex: SqlExpression<any>, alias: string) {
//         this.selects.set(alias, ex)
//     }

//     /**
//      * Sets multiple expressions in the `SELECT` clause at once, returning an object of the right types to receive the result.
//      */
//     selectResult<R extends Record<string, SqlExpression<any>>>(query: R): { [K in keyof R]: NativeFor<R[K]> } {
//         for (const [alias, ex] of Object.entries(query)) {
//             this.selects.set(alias, ex)
//         }
//         return {} as any
//     }

//     /**
//      * Adds a boolean expression to the `WHERE` clause, connected with `AND`.
//      */
//     where(ex: SqlExpression<'BOOLEAN'>) {
//         this.wheres.push(ex)
//     }

//     toSql() {
//         const select = 'SELECT ' + Array.from(this.selects.entries()).map(([alias, ex]) => `${ex.toSql(true)} AS ${alias}`).join(',\n       ') + "\n"
//         const where = this.wheres.length > 0 ? ('WHERE  ' + this.wheres.map(w => w.toSql(true)).join('\n   AND ') + "\n") : ""
//         return select + this.from.toSql() + where
//     }
// }


