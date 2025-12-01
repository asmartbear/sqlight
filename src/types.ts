
/** `null` or `undefined` */
export type Nullish = null | undefined

/** Flatten `{} & {} & ... & {}` into a single structure. */
export type Flatten<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/** A data type that can be stored in a SQLite database. */
export type SqlType = 'TEXT' | 'VARCHAR' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'TIMESTAMP' | 'BLOB'

/** SQLite boolean value, which is a `0` or `1` */
export type SqlBoolean = 0 | 1

/**
 * Converts a SQL type into a native Typescript type, whether a basic SQLType
 * or a `SqlExpression` class that results in some type.
 */
export type NativeFor<D extends SqlType> =
    D extends 'BOOLEAN' ? SqlBoolean :
    D extends 'VARCHAR' ? string :
    D extends 'TEXT' ? string :
    D extends 'INTEGER' ? number :
    D extends 'REAL' ? number :
    D extends 'TIMESTAMP' ? Date :
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
    T extends Date ? 'TIMESTAMP' :
    T extends Buffer ? 'BLOB' :
    never;


/** Defines a column in a row, either for a result-set or for input, with type and whether it can be `NULL`. */
export type RowColumn = {
    type: SqlType,
    nullable?: boolean,
}

/** A set of row-columns that defines a row of input or output. */
export type RowColumns = Record<string, RowColumn>;

/** Converts a `RowColumns` object to one of native types, used to actually send or receive row data. */
export type NativeForRowColumns<RC extends RowColumns> = {
    [K in keyof RC]: NativeFor<RC[K]['type']> | (RC[K]['nullable'] extends true ? null : never)
};

/** 
 * Defines the schema of a column, with type and whether it can be `NULL` (like resultset rows),
 * as well as data needed to create it as a table, like whether has keys and indexes.
 */
export type SchemaColumn = RowColumn & {

    /** True if this is also a primary key constraint */
    pk?: boolean,

    /** True if this column is also unique.  (Already assumed if `pk`) */
    unique?: boolean,

    /** Text comment describing the column, for a human */
    comment?: string,
}

/** A set of row-columns that defines a row of input or output. */
export type SchemaColumns = Record<string, SchemaColumn>;

/** A structure consisting of just the key name and key value for the primary key of a set of columns. */
export type PrimaryKeyForSchemaColumns<RC extends SchemaColumns> = {
    [K in keyof RC as RC[K]['pk'] extends true ? K : never]:
    NativeFor<RC[K]['type']> | (RC[K]['nullable'] extends true ? null : never)
}

/** Like `NativeForRowColumns` but for UPDATE operations, which means primary key is the only mandatory field. */
export type NativeUpdateForSchemaColumns<RC extends SchemaColumns> =
    {
        [K in keyof RC as RC[K]['pk'] extends true ? K : never]:
        NativeFor<RC[K]['type']> | (RC[K]['nullable'] extends true ? null : never)
    } & {
        [K in keyof RC as RC[K]['pk'] extends true ? never : K]?:
        NativeFor<RC[K]['type']> | (RC[K]['nullable'] extends true ? null : never)
    };

/** Defines the schema of a table, with a list of columns and other table configuration. */
export type SchemaTable = {
    columns: SchemaColumns,
}

/** Defines an entire database, with a list of tables and other meta-data. */
export type SchemaDatabase<TABLES extends Record<string, SchemaTable>> = {
    tables: TABLES,
}

