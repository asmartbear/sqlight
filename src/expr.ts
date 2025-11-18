import { SqlType, NativeFor, SqlTypeFor } from './types'

/**
 * An input value to a SQL expression, either a supported native constant value or another
 * SQL expression.  The input to `EXPR()`, which converts it to a `SqlExpression`.
 */
export type SqlInputValue<D extends SqlType> = NativeFor<D> | SqlExpression<D>;

/**
 * Conversion of native Typescript values into SQL literals, or passes SqlExpression through unchanged.
 * The result of `EXPR()`.  If you want more specificity in constants (like integers versus floats), use
 * the literal functions like `INT()` and `FLOAT()`.
 */
export type SqlExprFromNative<T> =
    T extends boolean ? SqlLiteral<'BOOLEAN', T> :
    T extends string ? SqlLiteral<'TEXT', T> :
    T extends number ? SqlLiteral<SqlTypeFor<T>, NativeFor<SqlTypeFor<T>>> :
    T extends Buffer ? SqlLiteral<'BLOB', T> :
    T extends SqlExpression<infer U> ? T :
    never;

/** A BOOLEAN-typed literal */
export function BOOL<T extends boolean>(x: T) {
    return new SqlLiteral('BOOLEAN', x)
}

/** A TEXT-typed literal */
export function STR<T extends string>(x: T) {
    return new SqlLiteral('TEXT', x)
}

/** An INT-typed literal */
export function INT<T extends number>(x: T) {
    return new SqlLiteral('INTEGER', x)
}

/** An REAL-typed literal */
export function FLOAT<T extends number>(x: T) {
    return new SqlLiteral('REAL', x)
}

/** An BLOB-typed literal */
export function BLOB<T extends Buffer>(x: T) {
    return new SqlLiteral('BLOB', x)
}

/**
 * Converts a native Typescript value into a SQL literal, or passes a SqlExpression through unchanged.
 * Essentially converts any kind of input value into something SQL understands.
 */
export function EXPR<V extends string | boolean | number | Buffer>(x: V): SqlExprFromNative<V>;
export function EXPR<D extends SqlType>(x: SqlExpression<D>): typeof x;             // pass-through when we know it
export function EXPR<D extends SqlType>(x: SqlInputValue<D>): SqlExpression<D>;     // conversion when it's any input value
export function EXPR(x: SqlExpression<any> | boolean | string | number | Buffer): SqlExpression<any> {
    if (x instanceof SqlExpression) return x
    if (typeof x === "string") return STR(x)
    if (typeof x === "number") return Number.isInteger(x) ? INT(x) : FLOAT(x)
    if (typeof x === "boolean") return BOOL(x)
    if (x instanceof Buffer) return BLOB(x)
    throw new Error(`Unsupported literal type: ${typeof x}: [${x}]`)
}

/**
 * Runs `EXPR` against a list of SQL expressions of the same type.
 */
export function EXPRs<D extends SqlType>(list: SqlInputValue<D>[]): SqlExpression<D>[] {
    return list.map(EXPR) as any
}

/**
 * Generic base-class for all SQL expressions, which carries a data type and restrictions,
 * and can be converted to SQL.
 */
export abstract class SqlExpression<D extends SqlType> {
    constructor(
        public readonly type: D,
    ) { }

    /**
     * Returns SQL for this expression.
     * 
     * @param grouped If true, and if this expression is not already atomic, it needs to be enclosed in parentheses.
     */
    abstract toSql(grouped: boolean): string

    /**
     * True if this expression could potentially be `NULL`.
     */
    abstract canBeNull(): boolean

    /** Boolean result of asking whether this expression is NULL */
    isNotNull(): SqlExpression<'BOOLEAN'> {
        return new SqlIsNotNull(this)
    }

    /** Returns the first non-null expression */
    coalesce(...rhs: SqlInputValue<D>[]): SqlExpression<D> {
        return new SqlCoalesce([this, ...EXPRs(rhs)])
    }

    eq(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '=', this, EXPR(rhs))
    }
    ne(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '!=', this, EXPR(rhs))
    }
    lt(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '<', this, EXPR(rhs))
    }
    le(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '<=', this, EXPR(rhs))
    }
    gt(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '>', this, EXPR(rhs))
    }
    ge(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '>=', this, EXPR(rhs))
    }

    add<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('+', this as any, EXPR(rhs))
    }
    sub<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('-', this as any, EXPR(rhs))
    }
    mul<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('*', this as any, EXPR(rhs))
    }
    div<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<'REAL'> {
        return new SqlBinaryOperator('REAL', '/', this, EXPR(rhs))
    }

    inList(list: SqlInputValue<D>[]): SqlExpression<'BOOLEAN'> {
        return new SqlInList(this, EXPRs(list))
    }
}

/**
 * A literal (constant) value.
 */
class SqlLiteral<D extends SqlType, T extends NativeFor<D>> extends SqlExpression<D> {
    constructor(
        type: D,
        private readonly value: T,
    ) { super(type) }

    canBeNull(): boolean { return false }

    toSql() {
        if (typeof this.value === "boolean") return this.value ? 'TRUE' : 'FALSE'
        if (typeof this.value === "string") return `'${this.value.replace(/'/g, "''")}'`
        if (this.value instanceof Buffer) return `x'${this.value.toString("hex")}'`
        return String(this.value)
    }
}

class SqlIsNotNull extends SqlExpression<'BOOLEAN'> {
    constructor(
        private readonly ex: SqlExpression<any>,
    ) { super('BOOLEAN') }

    canBeNull(): boolean { return false }

    toSql() { return `${this.ex.toSql(true)} IS NOT NULL` }
}

/** Any binary operator.  */
class SqlBinaryOperator<D extends SqlType> extends SqlExpression<D> {
    constructor(
        type: D,
        private readonly op: string,
        private readonly lhs: SqlExpression<any>,
        private readonly rhs: SqlExpression<any>,
    ) { super(type) }

    canBeNull(): boolean { return this.lhs.canBeNull() || this.rhs.canBeNull() }

    toSql(grouped: boolean) {
        let sql = `${this.lhs.toSql(true)} ${this.op} ${this.rhs.toSql(true)}`
        if (grouped) sql = '(' + sql + ')'
        return sql
    }
}

/** Binary arithmetic, where combos of `REAL` and `INTEGER` result in `REAL`. */
class SqlBinaryArithmeticOperator<LHS extends 'INTEGER' | 'REAL', RHS extends 'INTEGER' | 'REAL', D extends LHS extends 'REAL' ? 'REAL' : RHS extends 'REAL' ? 'REAL' : 'INTEGER'> extends SqlBinaryOperator<D> {
    constructor(op: string, lhs: SqlExpression<LHS>, rhs: SqlExpression<any>) {
        super(lhs.type == 'REAL' || rhs.type == 'REAL' ? 'REAL' : 'INTEGER' as any, op, lhs, rhs)
    }
}

class SqlCoalesce<D extends SqlType> extends SqlExpression<D> {
    constructor(
        private readonly list: SqlExpression<D>[],
    ) {
        super(list[0].type)
    }

    canBeNull(): boolean {
        // If any of the items are never null, then we can't be null either.
        // Otherwise, we could be, since all of them could simultaneously be.
        return this.list.every(s => s.canBeNull())
    }

    toSql() {
        return `COALESCE(${this.list.map(e => e.toSql(false)).join(',')})`
    }
}

class SqlInList<D extends SqlType> extends SqlExpression<'BOOLEAN'> {
    constructor(
        private readonly ex: SqlExpression<D>,
        private readonly list: SqlExpression<D>[],
    ) { super('BOOLEAN') }

    canBeNull(): boolean { return false }

    toSql(grouped: boolean) {
        let sql = `${this.ex.toSql(true)} IN (${this.list.map(e => e.toSql(true)).join(',')})`
        if (grouped) sql = '(' + sql + ')'
        return sql
    }
}