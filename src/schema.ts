import * as D from '@asmartbear/dyn'
import invariant from 'tiny-invariant';
import { Nullish, SqlType, NativeFor, SchemaColumn, SchemaTable, SchemaDatabase, RowColumns, NativeForRowColumns, Flatten, SqlTypeFor } from './types'
import { SqlExpression, SqlInputValue, EXPR, AND, LITERAL } from './expr'

/** Converts a static schema into something Typescript understands in detail */
export function SCHEMA<TABLES extends Record<string, SchemaTable>>(schema: SchemaDatabase<TABLES>): SqlSchema<TABLES> {
    return new SqlSchema(schema)
}

/** Extracts the TABLES type from an instantiated SqlSchema */
export type TablesOf<S> = S extends SqlSchema<infer TABLES> ? TABLES : never

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
     * Generates the SQL for creating a table from the current schema.
     * 
     * @param tableName the name of the table from the schema
     * @param ifNotExists whether to include `IF NOT EXISTS` in the creation SQL
     */
    getCreateTableSql<TABLENAME extends keyof TABLES>(tableName: TABLENAME, ifNotExists: boolean): string {
        let sql = 'CREATE TABLE '
        if (ifNotExists) sql += 'IF NOT EXISTS '
        sql += `${String(tableName)} ( `
        sql += Object.entries(this.schema.tables[tableName].columns).map(([name, col]) => {
            var field = `${name} ${col.type}`
            if (!col.nullable) field += ' NOT NULL'
            if (col.pk) field += ' PRIMARY KEY'
            return field
        }).join(', ')
        sql += ' )'
        return sql
    }

    /** Generates the SQL for a single row of literal values, in column order, suitable for `INSERT` */
    getInsertRowsSql<TABLENAME extends keyof TABLES>(tableName: TABLENAME, rows: NativeForRowColumns<TABLES[TABLENAME]["columns"]>[] | D.Nullish): string {
        if (!D.NOT_EMPTY(rows)) return ""
        const formatter = new RowFormatter(this.schema.tables[tableName].columns)
        const data = rows.map(row => {
            const expressions = formatter.getSqlExpressions(row)
            return '(' + D.VALUES(expressions).map(e => e.toSql(false)).join(',') + ')'
        })
        const cols = '(' + formatter.getColumnList().join(',') + ')'
        return `INSERT INTO ${String(tableName)} ${cols} VALUES\n${data.join(',\n')}`
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
        super(column.type, column.nullable === true)
    }

    toSql() { return `${this.tableAlias}.${this.columnName}` }
}

export type SqlJoinType = 'JOIN' | 'LEFT JOIN' | 'CROSS JOIN'

/** Internal type for a table, optionally with some join expression. */
type JoinedTable<TABLES extends Record<string, SchemaTable>, TABLENAME extends keyof TABLES, TALIAS extends string> = {
    table: SqlFromTable<TABLES, TABLENAME, TALIAS>,
    joinType?: SqlJoinType,
    joiner?: SqlExpression<'BOOLEAN'>,
}

/** Internal type to store an ordering element */
type OrderBy = {
    value: SqlExpression<SqlType>,
    ascending: 'ASC' | 'DESC',
}

/** Extracts the native row type for a select statement. */
export type NativeSelectRow<S> = S extends SqlSelect<any, infer NATIVEROW> ? Flatten<NATIVEROW> : never;

/** The strings of the select columns */
export type SelectKeys<S> = keyof NativeSelectRow<S> & string;

/** A SQL select expression. */
export class SqlSelect<TABLES extends Record<string, SchemaTable>, NATIVEROW extends Record<string, any> = {}> {

    private readonly selectSql = new Map<string, SqlExpression<SqlType>>()
    private readonly joins: JoinedTable<TABLES, keyof TABLES, string>[] = []
    private readonly wheres: SqlExpression<'BOOLEAN'>[] = []
    private readonly orderBys: OrderBy[] = []
    private limit: number = Number.MAX_SAFE_INTEGER
    private offset: number = 0

    constructor(
        public readonly schema: SqlSchema<TABLES>
    ) {

    }

    /** Returns a SQL expression that is the result of running this query, selecting just the column in question */
    asSubquery<TALIAS extends SelectKeys<this>>(alias: TALIAS): SqlExpression<SqlTypeFor<NATIVEROW[TALIAS]>> {
        const expr = this.selectSql.get(alias)
        invariant(expr)
        return new SqlSubquery(expr.type, '(' + this.toSql() + ')') as any
    }

    /** Sets a select clause of a given aliased name with a SQL expression, or replaces a previous one. */
    select<TALIAS extends string, D extends SqlType>(alias: TALIAS, sql: SqlInputValue<D>) {
        this.selectSql.set(alias, EXPR(sql))
        return this as SqlSelect<TABLES, NATIVEROW & { [K in TALIAS]: NativeFor<D> }>
    }

    /** Same as `select()` when we want to pass through a table column unchanged. */
    passThrough<COLNAME extends string, COLUMN extends SchemaColumn>(col: SqlColumn<COLNAME, COLUMN>) {
        return this.select<COLNAME, COLUMN["type"]>(col.columnName, col)
    }

    /**
     * Creates a table for a "from" clause, wrapping a table with an alias.
     * 
     * @param alias the local query name of the table; the same table can be included multiple times with different aliases
     * @param tableName the schema name of the table to scan
     * @param joinType the join style, or undefined if there's no join
     * @param fJoin function that takes the new table as an argument, and returns the SQL expression for the join
     */
    from<TABLENAME extends keyof TABLES, TALIAS extends string>(alias: TALIAS, tableName: TABLENAME, joinType?: SqlJoinType, fJoin?: (t: SqlFromTable<TABLES, TABLENAME, TALIAS>) => SqlExpression<'BOOLEAN'>) {
        const table = new SqlFromTable(this.schema.schema.tables, tableName, alias)
        this.joins.push({
            table,
            joinType,
            joiner: (joinType && fJoin) ? fJoin(table) : undefined,
        })
        return table
    }

    /** Adds a WHERE clause with AND */
    where(sql: SqlInputValue<'BOOLEAN'>): this {
        this.wheres.push(EXPR(sql))
        return this
    }

    /** Limit the number of results to this. */
    setLimit(n: number): this {
        this.limit = n
        return this
    }

    /** Start the result offset by this many rows. */
    setOffset(n: number): this {
        this.offset = n
        return this
    }

    /** Appends another ORDER BY clause, breaking ties from the previous clauses */
    orderBy(sql: SqlInputValue<SqlType>, ascending: 'ASC' | 'DESC'): this {
        this.orderBys.push({ value: EXPR(sql), ascending })
        return this
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
        if (this.joins.length > 0) {
            const tableSql = this.joins.map(join => {
                let sql = `${String(join.table.tableName)} ${join.table.alias}`
                if (join.joinType && join.joiner) {
                    sql = `${join.joinType} ${sql} ON ${join.joiner.toSql(true)}`
                }
                return sql
            })
            pieces.push('FROM ' + tableSql.join(' '))
        }

        // WHERE
        if (this.wheres.length > 0) {
            pieces.push('WHERE ' + AND(...this.wheres).toSql(false))
        }

        // ORDER BY
        if (this.orderBys.length > 0) {
            pieces.push('ORDER BY ' + this.orderBys.map(clause =>
                `${clause.value.toSql(false)} ${clause.ascending}`
            ).join(', '))
        }

        // LIMIT/OFFSET
        const sqlLimit = this.limit < Number.MAX_SAFE_INTEGER ? `LIMIT ${this.limit}` : ''
        const sqlOffset = this.offset > 0 ? ` OFFSET ${this.offset}` : ''
        if (sqlLimit || sqlOffset) {
            pieces.push(sqlLimit + sqlOffset)
        }

        // done
        return pieces.join('\n')
    }
}

class SqlSubquery<D extends SqlType> extends SqlExpression<D> {
    constructor(
        type: D,
        private readonly sql: string,
    ) { super(type, true) }
    toSql() { return this.sql }
}

/** Class that can format native data according to its SQL row specification. */
class RowFormatter<COLS extends RowColumns> {

    constructor(
        public readonly columns: COLS,
    ) {
    }

    getSqlExpressions(row: NativeForRowColumns<COLS>): { [K in keyof COLS]: SqlExpression<COLS[K]['type']> } {
        return D.OMAP(this.columns, (col, name) =>
            LITERAL(col.type, row[name])
        )
    }

    getColumnList() {
        return D.KEYS(this.columns)
    }
}