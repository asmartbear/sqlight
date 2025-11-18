
/** `null` or `undefined` */
export type Nullish = null | undefined

/** A data type that can be stored in a SQLite database. */
export type SqlType = 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'BLOB'

/**
 * Converts a SQL type into a native Typescript type, whether a basic SQLType
 * or a `SqlExpression` class that results in some type.
 */
export type NativeFor<D extends SqlType> =
    D extends 'BOOLEAN' ? boolean :
    D extends 'TEXT' ? string :
    D extends 'INTEGER' ? number :
    D extends 'REAL' ? number :
    D extends 'BLOB' ? Buffer :
    never;

/**
 * Converts a native Typescript type to the corresponding SqlType as best we can.
 * It's "best effort" because e.g. with generic numbers we cannot tell whether it's
 * an `INTEGER` or `REAL`, although we _can_ tell if it's a constant.
 */
export type SqlTypeFor<T> =
    T extends boolean ? 'BOOLEAN' :
    T extends string ? 'TEXT' :
    T extends number ? (`${T}` extends `${bigint}` ? 'INTEGER' : ('INTEGER' | 'REAL')) :
    T extends Buffer ? 'BLOB' :
    never;

/**
 * Defines the schema of a column, with type and whether it can be `NULL`.
 */
export type SchemaColumn = {
    type: SqlType,
    nullable?: boolean,
    pk?: boolean,
}

/**
 * Defines the schema of a table, with a list of columns and other table configuration.
 */
export type SchemaTable = {
    columns: Record<string, SchemaColumn>,
}

/**
 * Defines an entire database, with a list of tables and other meta-data.
 */
export type SchemaDatabase = {
    tables: Record<string, SchemaTable>,
}

