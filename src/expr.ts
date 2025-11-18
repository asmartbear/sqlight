import { invariant } from './invariant';
import { Nullish, SqlType, NativeFor, SqlTypeFor } from './types'

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

/**
 * An object that has a SQL type, but also an array or tuple of such objects, or Nullish.
 */
type SqlTypedGeneral<D extends SqlType> =
    Nullish |
    SqlExpression<D> |
    SqlTypedGeneral<D>[] |
    readonly SqlTypedGeneral<D>[];

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
    // istanbul ignore next
    if (x instanceof SqlExpression) return x
    if (typeof x === "string") return STR(x)
    if (typeof x === "number") return Number.isInteger(x) ? INT(x) : FLOAT(x)
    if (typeof x === "boolean") return BOOL(x)
    if (x instanceof Buffer) return BLOB(x)
    throw new Error(`Unsupported literal type: ${typeof x}: [${x}]`)
}

/** Expression, or undefined */
export function EXPR_UNDEF<D extends SqlType>(x: SqlInputValue<D> | undefined): SqlExpression<D> | undefined {
    return x ? EXPR(x) : undefined
}

/**
 * Runs `EXPR` against a list of SQL expressions of the same type.
 */
export function EXPRs<D extends SqlType>(list: readonly SqlInputValue<D>[]): readonly SqlExpression<D>[] {
    return list.map(EXPR) as any
}

/**
 * Returns the SQL type from an expression or list of expressions, which also can be Nullish and such.
 * 
 * Returns `undefined` if there's nothing, or nothing in any list.
 */
export function TYPE<D extends SqlType>(...x: SqlTypedGeneral<D>[]): D | undefined {
    if (!x || x.length == 0) return undefined
    for (const s of x) {
        if (!s) continue
        if (s instanceof SqlExpression) return s.type
        const t = TYPE<D>(...s)
        if (t) return t
    }
    return undefined
}

/** Returns the first non-null expression in a list of expressions */
export function COALESCE<D extends SqlType>(...list: readonly SqlInputValue<D>[]): SqlExpression<D> {
    return new SqlCoalesce(EXPRs(list))
}

/** Concatenates strings */
export function CONCAT(...list: readonly SqlInputValue<'TEXT'>[]): SqlExpression<'TEXT'> {
    return new SqlConcat(EXPRs(list))
}

/**
 * A series of `CASE WHEN ... THEN ... END` expressions as tuples, and optionally another expression for `ELSE`.
 * If you don't have an expression for `ELSE`, it will return `NULL`.
 */
export function CASE<D extends SqlType>(whenList: readonly [SqlExpression<'BOOLEAN'>, SqlInputValue<D>][], elseExpr?: SqlInputValue<D>): SqlExpression<D> {
    return new SqlCase<D>(whenList.map(pair => [pair[0], EXPR(pair[1])] as const), EXPR_UNDEF(elseExpr))
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

    /** Boolean result of asking whether this expression is `NOT NULL` */
    isNotNull(): SqlExpression<'BOOLEAN'> { return new SqlIsNotNull(this) }

    /** Boolean result of asking whether this expression is `NULL` */
    isNull(): SqlExpression<'BOOLEAN'> { return new SqlIsNull(this) }

    eq(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '=', this, EXPR(rhs)) }
    ne(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '!=', this, EXPR(rhs)) }
    lt(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '<', this, EXPR(rhs)) }
    le(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '<=', this, EXPR(rhs)) }
    gt(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '>', this, EXPR(rhs)) }
    ge(rhs: SqlInputValue<D>): SqlExpression<'BOOLEAN'> { return new SqlBinaryOperator('BOOLEAN', '>=', this, EXPR(rhs)) }

    add<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> { return new SqlBinaryArithmeticOperator('+', this as any, EXPR(rhs)) }
    sub<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> { return new SqlBinaryArithmeticOperator('-', this as any, EXPR(rhs)) }
    mul<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<R extends 'REAL' ? 'REAL' : D extends 'REAL' ? 'REAL' : 'INTEGER'> { return new SqlBinaryArithmeticOperator('*', this as any, EXPR(rhs)) }
    div<R extends 'INTEGER' | 'REAL'>(rhs: SqlInputValue<R>): SqlExpression<'REAL'> { return new SqlBinaryOperator('REAL', '/', this, EXPR(rhs)) }

    /** Boolean of whether this value is in the given list of values */
    inList(list: readonly SqlInputValue<D>[]): SqlExpression<'BOOLEAN'> { return new SqlInList(this, EXPRs(list)) }
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

class SqlIsNull extends SqlExpression<'BOOLEAN'> {
    constructor(private readonly ex: SqlExpression<any>) { super('BOOLEAN') }
    canBeNull(): boolean { return false }
    toSql() { return `${this.ex.toSql(true)} IS NULL` }
}

class SqlIsNotNull extends SqlExpression<'BOOLEAN'> {
    constructor(private readonly ex: SqlExpression<any>) { super('BOOLEAN') }
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
        private readonly list: readonly SqlExpression<D>[],
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

class SqlConcat extends SqlExpression<'TEXT'> {
    constructor(
        private readonly list: readonly SqlExpression<'TEXT'>[],
    ) {
        super('TEXT')
    }

    canBeNull(): boolean {
        return !this.list.every(s => !s.canBeNull())
    }

    toSql(grouped: boolean) {
        let sql = this.list.map(e => e.toSql(true)).join(' || ')
        if (grouped) sql = '(' + sql + ')'
        return sql
    }
}

class SqlInList<D extends SqlType> extends SqlExpression<'BOOLEAN'> {
    constructor(
        private readonly ex: SqlExpression<D>,
        private readonly list: readonly SqlExpression<D>[],
    ) { super('BOOLEAN') }

    canBeNull(): boolean { return false }

    toSql(grouped: boolean) {
        let sql = `${this.ex.toSql(true)} IN (${this.list.map(e => e.toSql(true)).join(',')})`
        if (grouped) sql = '(' + sql + ')'
        return sql
    }
}

class SqlCase<D extends SqlType> extends SqlExpression<D> {

    private readonly allValues: SqlExpression<D>[]

    constructor(
        private readonly whenList: readonly [SqlExpression<'BOOLEAN'>, SqlExpression<D>][],
        private readonly elseExpr?: SqlExpression<D>
    ) {
        const allValues = whenList.map(pair => pair[1])
        if (elseExpr) {
            allValues.push(elseExpr)
        }
        const type = TYPE(allValues)
        invariant(type, "what?")
        super(type)
        this.allValues = allValues
    }

    canBeNull(): boolean {
        if (!this.elseExpr) return true     // because lack of ELSE specifically returns NULL
        return !this.allValues.every(s => !s.canBeNull())
    }

    toSql() {
        let sql = this.whenList.map(
            ([whenExpr, thenExpr]) => {
                return `WHEN ${whenExpr.toSql(false)} THEN ${thenExpr.toSql(false)}`
            }
        ).join(' ')
        if (this.elseExpr) {
            sql += " ELSE " + this.elseExpr.toSql(false)
        }
        return `CASE ${sql} END`
    }
}