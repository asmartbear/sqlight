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

/**
 * Converts a native Typescript value into a SQL literal, or passes a SqlExpression through unchanged.
 * Essentially converts any kind of input value into something SQL understands.
 */
export function EXPR<V extends string | boolean | number | Buffer>(x: V): SqlExprFromNative<V>;
export function EXPR<D extends SqlType>(x: SqlExpression<D>): typeof x;             // pass-through when we know it
export function EXPR<D extends SqlType>(x: SqlInputValue<D>): SqlExpression<D>;     // conversion when it's any input value
export function EXPR(x: SqlExpression<any> | boolean | string | number | Buffer): SqlExpression<any> {
    if (x instanceof SqlExpression) return x
    if (typeof x === "boolean") return BOOL(x)
    if (typeof x === "string") return STR(x)
    if (typeof x === "number") return Number.isInteger(x) ? INT(x) : FLOAT(x)
    if (x instanceof Buffer) return new SqlLiteral('BLOB', x) as any
    throw new Error(`Unsupported literal type: ${typeof x}: [${x}]`)
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
    isNotNull(): SqlIsNotNull {
        return new SqlIsNotNull(this)
    }

    eq(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '=', this, EXPR(rhs))
    }
    ne(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '!=', this, EXPR(rhs))
    }
    lt(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '<', this, EXPR(rhs))
    }
    le(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '<=', this, EXPR(rhs))
    }
    gt(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '>', this, EXPR(rhs))
    }
    ge(rhs: SqlInputValue<D>): SqlBinaryOperator<'BOOLEAN'> {
        return new SqlBinaryOperator('BOOLEAN', '>=', this, EXPR(rhs))
    }

    add<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlBinaryOperator<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('+', this as any, EXPR(rhs))
    }
    sub<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlBinaryOperator<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('-', this as any, EXPR(rhs))
    }
    mul<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlBinaryOperator<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> {
        return new SqlBinaryArithmeticOperator('*', this as any, EXPR(rhs))
    }
    div<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlBinaryOperator<'REAL'> {
        return new SqlBinaryOperator('REAL', '/', this, EXPR(rhs))
    }

    inList(list: SqlInputValue<D>[]) {
        return new SqlInList(this, list.map(e => EXPR(e)))
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

/**
 * Any binary operator.
 */
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

/**
 * Binary arithmetic, where combos of `REAL` and `INTEGER` result in `REAL`.
 */
class SqlBinaryArithmeticOperator<LHS extends 'INTEGER' | 'REAL', RHS extends 'INTEGER' | 'REAL', D extends LHS extends 'REAL' ? 'REAL' : RHS extends 'REAL' ? 'REAL' : 'INTEGER'> extends SqlBinaryOperator<D> {
    constructor(op: string, lhs: SqlExpression<LHS>, rhs: SqlExpression<any>) {
        super(lhs.type == 'REAL' || rhs.type == 'REAL' ? 'REAL' : 'INTEGER' as any, op, lhs, rhs)
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