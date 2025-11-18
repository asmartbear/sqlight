
const DEBUG_SQL = false


/**
 * A `FROM` reference to a table, with an alias.
 */
class SqlTable<S extends SchemaDatabase, TABLE extends string & keyof S['tables'], TALIAS extends string> {
    public readonly table: S['tables'][TABLE]
    constructor(
        public readonly schema: S,
        public readonly tableName: TABLE,
        public readonly alias: TALIAS,
    ) {
        this.table = schema.tables[tableName] as any
    }

    /**
     * Returns the SQL expression referencing a column in this table.
     */
    column<COLNAME extends string & keyof S['tables'][TABLE]['columns']>(columnName: COLNAME): SqlColumn<S, TABLE, TALIAS, COLNAME> {
        return new SqlColumn(this, columnName)
    }
}

/**
 * A reference to a column that is from a table-reference from a `FROM` clause.
 */
class SqlColumn<S extends SchemaDatabase, TABLE extends string & keyof S['tables'], TALIAS extends string, COLNAME extends string & keyof S['tables'][TABLE]['columns']> extends SqlExpression<S['tables'][TABLE]['columns'][COLNAME]['type']> {
    public readonly column: S['tables'][TABLE]['columns'][COLNAME]
    constructor(
        public readonly tableRef: SqlTable<S, TABLE, TALIAS>,
        public readonly columnName: COLNAME,
    ) {
        super(tableRef.table.columns[columnName].type)
        this.column = tableRef.table.columns[columnName] as any
    }

    canBeNull(): boolean { return !!this.column.nullable }

    toSql() { return `${this.tableRef.alias}.${this.columnName}` }
}

/**
 * A `FROM` clause, which can contain tables with joins.
 */
export class SqlFrom<S extends SchemaDatabase> {
    private readonly froms: SqlTable<S, string, string>[] = []

    constructor(
        public readonly schema: S
    ) { }

    /**
     * Adds a table to the `FROM` clause, returning it.
     */
    table<TABLE extends string & keyof S['tables'], TALIAS extends string>(tableName: TABLE, alias: TALIAS): SqlTable<S, TABLE, TALIAS> {
        const table = new SqlTable(this.schema, tableName, alias)
        this.froms.push(table)
        return table
    }

    toSql() {
        return 'FROM ' + this.froms.map(from => `"${from.tableName}" ${from.alias}`).join(', ') + "\n"
    }
}

/**
 * A 'SELECT' clause, with subclauses.
 */
export class SqlSelect<S extends SchemaDatabase> {
    private readonly selects = new Map<string, SqlExpression<any>>()
    public readonly from: SqlFrom<S>
    private readonly wheres: SqlExpression<'BOOLEAN'>[] = []

    constructor(
        public readonly schema: S,
    ) {
        this.from = new SqlFrom(schema)
    }

    /**
     * Add/replace one expression in the `SELECT` clause.
     */
    select(ex: SqlExpression<any>, alias: string) {
        this.selects.set(alias, ex)
    }

    /**
     * Sets multiple expressions in the `SELECT` clause at once, returning an object of the right types to receive the result.
     */
    selectResult<R extends Record<string, SqlExpression<any>>>(query: R): { [K in keyof R]: NativeFor<R[K]> } {
        for (const [alias, ex] of Object.entries(query)) {
            this.selects.set(alias, ex)
        }
        return {} as any
    }

    /**
     * Adds a boolean expression to the `WHERE` clause, connected with `AND`.
     */
    where(ex: SqlExpression<'BOOLEAN'>) {
        this.wheres.push(ex)
    }

    toSql() {
        const select = 'SELECT ' + Array.from(this.selects.entries()).map(([alias, ex]) => `${ex.toSql(true)} AS ${alias}`).join(',\n       ') + "\n"
        const where = this.wheres.length > 0 ? ('WHERE  ' + this.wheres.map(w => w.toSql(true)).join('\n   AND ') + "\n") : ""
        return select + this.from.toSql() + where
    }
}


// const MySchema = {
//     tables: {
//         outline: {
//             columns: {
//                 id: { type: 'TEXT', pk: true, },
//                 slug: { type: 'TEXT' },
//                 level: { type: 'INTEGER' },
//                 title: { type: 'TEXT' },
//                 summary: { type: 'TEXT', nullable: true },
//                 markdown: { type: 'TEXT' },
//             },
//         },
//         embeddings: {
//             columns: {
//                 id: { type: 'TEXT', pk: true, },
//                 category: { type: 'TEXT' },
//                 v: { type: 'BLOB' },
//             }
//         },
//     }
// } as const;


// const foo = CONST("foo")
// const bar = CONST(123)

// const select = new SqlSelect(MySchema)
// const out = select.from.table('outline', 'out')
// const id = out.column('id')
// select.select(EQ(id, bar), "is_something")
// select.where(id.isNotNull())


export type DbDataType = NativeFor<SQLType>

export type DbColumn<C extends SchemaColumn> = NativeFor<C['type']> | (C['nullable'] extends true ? null : never)

export type DbTable<T extends SchemaTable> = {
    [K in keyof T['columns']]: DbColumn<T['columns'][K]>
}

export type DbDatabase<S extends SchemaDatabase> = {
    tables: { [K in keyof S['tables']]: DbTable<S['tables'][K]> }
}

export type DbRow = { [K in string]: DbDataType }













export type QueryOptions = {
    where?: string,
    values?: NativeFor<SQLType>[]
}


/**
 * Utility for working with SQLite databases
 */
export class Sqlite<S extends SchemaDatabase> {

    private constructor(
        public readonly schema: S,
        public readonly sqlite: AsyncDatabase,
    ) { }

    /**
     * Mutexes for each database path.
     */
    static withMutexes = new Map<string, Mutex>()

    /**
     * Opens a temporary connection to the database, runs the given function, then closes the connection.
     * Returns the result of the function.  Allows only one thread at a time to run with the database.
     */
    static async with<S extends SchemaDatabase, T>(schema: S, path: Path, fExecute: (db: Sqlite<S>) => Promise<T>): Promise<T> {
        let mutex = this.withMutexes.get(path.absPath)
        if (!mutex) {
            mutex = new Mutex()
            this.withMutexes.set(path.absPath, mutex)
        }
        return await mutex.runExclusive(async () => {
            const db = await Sqlite.open<S>(schema, path)
            try {
                return await fExecute(db)
            } finally {
                await db.close()
            }
        })
    }

    /**
     * Opens a new connection to the database.
     */
    private static async open<S extends SchemaDatabase>(schema: S, path: Path): Promise<Sqlite<S>> {
        return new Sqlite(schema, await AsyncDatabase.open(path.absPath))
    }

    /**
     * Closes the connection to the database.
     */
    private async close() {
        await this.sqlite.close()
    }

    /**
     * Creates tables with the right schema.
     */
    async initialize() {
        for (const [tableName, table] of Object.entries(this.schema.tables)) {
            const columns = Object.entries(table.columns).map(([columnName, column]) => {
                const parts = [`"${columnName}"`, column.type]
                if (column.pk) {
                    parts.push('PRIMARY KEY')
                }
                if (!column.nullable) {
                    parts.push('NOT NULL')
                }
                return parts.join(' ')
            }).join(',')
            const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns})`
            if (DEBUG_SQL) {
                console.log(sql)
            }
            await this.sqlite.run(sql)
        }
    }

    /**
     * Inserts rows into the database, returning `this` for chaining.
     * 
     * @param withReplace if true, this is an `UPSERT`.
     */
    async insert<TableName extends keyof S['tables']>(table: TableName, rows: DbTable<S['tables'][TableName]>[], withReplace: boolean = false): Promise<this> {
        const tableSql = `"${String(table)}"`
        const keys = Object.keys(rows[0])
        const keySql = keys.map(key => `"${key}"`).join(',')
        const values = flatten(rows.map(row => Object.values(row)))
        const placeholderRow = '(' + keys.map(() => '?').join(',') + ')'
        const placeholders = rows.map(() => placeholderRow).join(',')
        const sql = `INSERT${withReplace ? ' OR REPLACE' : ''} INTO ${tableSql} (${keySql}) VALUES ${placeholders}`
        if (DEBUG_SQL) {
            console.log(sql)
        }
        await this.sqlite.run(sql, values)
        return this
    }

    /**
     * Runs a generic SELECT command, returning all rows as a list of maps of field names to data.
     */
    async select<R extends DbRow>(sql: string, values?: DbDataType[]): Promise<R[]> {
        if (DEBUG_SQL) {
            console.log(sql, values)
        }
        return this.sqlite.all(sql, values)
    }

    /**
     * Deletes rows from a single table.
     */
    async delete<TableName extends keyof S['tables']>(table: TableName, where?: string, values?: DbDataType[]) {
        const tableSql = `"${String(table)}"`
        if (where) where = `WHERE ${where}`
        const sql = `DELETE FROM ${tableSql} ${where}`
        if (DEBUG_SQL) {
            console.log(sql)
        }
        await this.sqlite.run(sql, values)
    }

    /**
     * Selects rows from a single table, returning them in one array.
     */
    // _prepareSelectStarFromTable<TableName extends keyof S['tables']>(table: TableName, options: QueryOptions) {
    //     const tableSql = `"${String(table)}"`
    //     const where = options.where ? "WHERE " + options.where : ""
    //     const sql = `SELECT * FROM ${tableSql} ${where}`
    //     if (DEBUG_SQL) {
    //         console.log(sql)
    //     }
    //     return this.sqlite.prepare(sql, options.values)
    // }

    /**
     * Selects rows from a single table, returning them in one array.
     */
    async selectStarFromTable<TableName extends keyof S['tables']>(table: TableName, options: QueryOptions): Promise<DbTable<S['tables'][TableName]>[]> {
        const tableSql = `"${String(table)}"`
        const where = options.where ? "WHERE " + options.where : ""
        const sql = `SELECT * FROM ${tableSql} ${where}`
        if (DEBUG_SQL) {
            console.log(sql, options.values)
        }
        return this.sqlite.all(sql, options.values)
    }

    /**
     * Returns a new `SELECT` builder object.
     */
    selectBuilder(): SqlSelect<S> {
        return new SqlSelect(this.schema)
    }

    /**
     * Runs a `SELECT` based on a builder object, prepopulated with all expressions except the `SELECT`
     * clause, which is given as a structure.  The result is executed, and a row list of the correct type is returned.
     */
    async selectRun<R extends Record<string, SqlExpression<any>>>(select: SqlSelect<S>, query: R): Promise<{ [K in keyof R]: NativeFor<R[K]> }[]> {
        select.selectResult(query)      // register that query
        const sql = select.toSql()
        if (DEBUG_SQL) {
            console.log(sql)
        }
        return this.sqlite.all(sql)
    }

}