

// export class Sqlite<S extends SchemaDatabase> {

//     private constructor(
//         public readonly schema: S,
//         public readonly sqlite: AsyncDatabase,
//     ) { }

//     /**
//      * Mutexes for each database path.
//      */
//     static withMutexes = new Map<string, Mutex>()

//     /**
//      * Opens a temporary connection to the database, runs the given function, then closes the connection.
//      * Returns the result of the function.  Allows only one thread at a time to run with the database.
//      */
//     static async with<S extends SchemaDatabase, T>(schema: S, path: Path, fExecute: (db: Sqlite<S>) => Promise<T>): Promise<T> {
//         let mutex = this.withMutexes.get(path.absPath)
//         if (!mutex) {
//             mutex = new Mutex()
//             this.withMutexes.set(path.absPath, mutex)
//         }
//         return await mutex.runExclusive(async () => {
//             const db = await Sqlite.open<S>(schema, path)
//             try {
//                 return await fExecute(db)
//             } finally {
//                 await db.close()
//             }
//         })
//     }

//     /**
//      * Opens a new connection to the database.
//      */
//     private static async open<S extends SchemaDatabase>(schema: S, path: Path): Promise<Sqlite<S>> {
//         return new Sqlite(schema, await AsyncDatabase.open(path.absPath))
//     }

//     /**
//      * Closes the connection to the database.
//      */
//     private async close() {
//         await this.sqlite.close()
//     }

//     /**
//      * Creates tables with the right schema.
//      */
//     async initialize() {
//         for (const [tableName, table] of Object.entries(this.schema.tables)) {
//             const columns = Object.entries(table.columns).map(([columnName, column]) => {
//                 const parts = [`"${columnName}"`, column.type]
//                 if (column.pk) {
//                     parts.push('PRIMARY KEY')
//                 }
//                 if (!column.nullable) {
//                     parts.push('NOT NULL')
//                 }
//                 return parts.join(' ')
//             }).join(',')
//             const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns})`
//             if (DEBUG_SQL) {
//                 console.log(sql)
//             }
//             await this.sqlite.run(sql)
//         }
//     }

//     /**
//      * Inserts rows into the database, returning `this` for chaining.
//      * 
//      * @param withReplace if true, this is an `UPSERT`.
//      */
//     async insert<TableName extends keyof S['tables']>(table: TableName, rows: DbTable<S['tables'][TableName]>[], withReplace: boolean = false): Promise<this> {
//         const tableSql = `"${String(table)}"`
//         const keys = Object.keys(rows[0])
//         const keySql = keys.map(key => `"${key}"`).join(',')
//         const values = flatten(rows.map(row => Object.values(row)))
//         const placeholderRow = '(' + keys.map(() => '?').join(',') + ')'
//         const placeholders = rows.map(() => placeholderRow).join(',')
//         const sql = `INSERT${withReplace ? ' OR REPLACE' : ''} INTO ${tableSql} (${keySql}) VALUES ${placeholders}`
//         if (DEBUG_SQL) {
//             console.log(sql)
//         }
//         await this.sqlite.run(sql, values)
//         return this
//     }

//     /**
//      * Runs a generic SELECT command, returning all rows as a list of maps of field names to data.
//      */
//     async select<R extends DbRow>(sql: string, values?: DbDataType[]): Promise<R[]> {
//         if (DEBUG_SQL) {
//             console.log(sql, values)
//         }
//         return this.sqlite.all(sql, values)
//     }

//     /**
//      * Deletes rows from a single table.
//      */
//     async delete<TableName extends keyof S['tables']>(table: TableName, where?: string, values?: DbDataType[]) {
//         const tableSql = `"${String(table)}"`
//         if (where) where = `WHERE ${where}`
//         const sql = `DELETE FROM ${tableSql} ${where}`
//         if (DEBUG_SQL) {
//             console.log(sql)
//         }
//         await this.sqlite.run(sql, values)
//     }

//     /**
//      * Selects rows from a single table, returning them in one array.
//      */
//     // _prepareSelectStarFromTable<TableName extends keyof S['tables']>(table: TableName, options: QueryOptions) {
//     //     const tableSql = `"${String(table)}"`
//     //     const where = options.where ? "WHERE " + options.where : ""
//     //     const sql = `SELECT * FROM ${tableSql} ${where}`
//     //     if (DEBUG_SQL) {
//     //         console.log(sql)
//     //     }
//     //     return this.sqlite.prepare(sql, options.values)
//     // }

//     /**
//      * Selects rows from a single table, returning them in one array.
//      */
//     async selectStarFromTable<TableName extends keyof S['tables']>(table: TableName, options: QueryOptions): Promise<DbTable<S['tables'][TableName]>[]> {
//         const tableSql = `"${String(table)}"`
//         const where = options.where ? "WHERE " + options.where : ""
//         const sql = `SELECT * FROM ${tableSql} ${where}`
//         if (DEBUG_SQL) {
//             console.log(sql, options.values)
//         }
//         return this.sqlite.all(sql, options.values)
//     }

//     /**
//      * Returns a new `SELECT` builder object.
//      */
//     selectBuilder(): SqlSelect<S> {
//         return new SqlSelect(this.schema)
//     }

//     /**
//      * Runs a `SELECT` based on a builder object, prepopulated with all expressions except the `SELECT`
//      * clause, which is given as a structure.  The result is executed, and a row list of the correct type is returned.
//      */
//     async selectRun<R extends Record<string, SqlExpression<any>>>(select: SqlSelect<S>, query: R): Promise<{ [K in keyof R]: DbData<R[K]> }[]> {
//         select.selectResult(query)      // register that query
//         const sql = select.toSql()
//         if (DEBUG_SQL) {
//             console.log(sql)
//         }
//         return this.sqlite.all(sql)
//     }

// }