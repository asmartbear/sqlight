/**
 * Given a type, returns the Class of that type.
 */
export type ClassOf<T> = (abstract new (...args: any[]) => T) | (new (...args: any[]) => T);

/**
 * Given a class, returns the instance-type that it creates.
 */
export type InstanceOf<C> = C extends new (...args: any[]) => infer T ? T : never;

export function be<T, E extends T>(actual: T, expected: E, message?: string): asserts actual is E {
    try {
        expect(actual).toBe(expected)
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

export function eq<T, E extends T>(actual: T, expected: E, message?: string): asserts actual is E {
    try {
        expect(actual).toEqual(expected)
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

/**
 * Asserts the object exists and of a specific type, clarifying that type for Typescript along the way.
 */
export function isInstance<T, C extends ClassOf<T>>(actual: T | null | undefined, cls: C): asserts actual is InstanceOf<C> {
    expect(actual).toBeInstanceOf(cls)
}

/**
 * Asserts the length of anything with a `length` field, like strings and arrays.
 * Fails if `null` or `undefined`, and also tells the caller that for typescript.
 */
export function len<T extends { length: number }>(actual: T | null | undefined, expected: number, message?: string): asserts actual is T {
    try {
        expect(actual?.length).toEqual(expected)
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

/**
 * Asserts that something is true.
 */
export function is(actual: boolean, message?: string): asserts actual is true {
    try {
        expect(actual).toBeTruthy()
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

/**
 * Asserts something is not undefined or Nullish.
 */
export function defined<T>(actual: T | undefined | null): asserts actual is T {
    expect(actual).toBeDefined()
    expect(actual).not.toBeNull()
}

/**
 * Asserts something is undefined.
 */
export function undef<T>(actual: T | undefined, message?: string): asserts actual is undefined {
    try {
        expect(actual).toBeUndefined()
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

/**
 * Asserts something is an integer, and optionally with inclusive minimum and maximum
 */
export function isInteger(actual: number, min?: number, max?: number, message?: string) {
    try {
        expect(Number.isSafeInteger(actual)).toBe(true)
    } catch (e: any) { if (message) { e.message = `${e.message}\n\nNot an integer: ${actual}\n\n${message}` } throw e }
    if (min !== undefined) {
        try {
            expect(actual).toBeGreaterThanOrEqual(min)
        } catch (e: any) { if (message) { e.message = `${e.message}\n\nViolated minimum: ${actual} ≤ ${min}\n\n${message}` } throw e }
    }
    if (max !== undefined) {
        try {
            expect(actual).toBeLessThanOrEqual(max)
        } catch (e: any) { if (message) { e.message = `${e.message}\n\nViolated maximum: ${actual} ≥ ${max}\n\n${message}` } throw e }
    }
}

/**
 * Asserts that a function throws a specific class of error.
 */
export function throws<T extends Error>(f: (...args: any) => unknown, errorClass?: ClassOf<T>, message?: string) {
    try {
        f()
        throw new Error(`Expected expression to throw an exception, but it didn't\n\n${message ?? ""}`.trim(), { cause: "unit test" })
    } catch (e) {
        if (e instanceof Error) {
            if (e.cause === "unit test") throw e       // pass it through
            if (errorClass) {
                be(e.constructor.name, errorClass.name, `Threw exception, but wrong class.\n\n${e.name} - ${e.message} - ${e.cause}\n\n${message ?? ""}`.trim())
            }
        }
    }
}

/**
 * A floating-point number reasonably close to another, since they can have silly round-off errors. 
 */
export function near(actual: number, expected: number, message?: string) {
    try {
        expect(actual).toBeCloseTo(expected)
    } catch (e: any) { if (message) { e.message = `${e.message}\n\n${message}` } throw e }
}

/**
 * Fields of numbers treated like `near`.
 */
export function nearFields<T extends Record<string, number>>(actual: T, expected: Partial<T>, message?: string) {
    for (const [k, v] of Object.entries(expected)) {
        try {
            expect(actual[k]).toBeCloseTo(v)
        } catch (e: any) { eq(actual, expected as any, message) }     // use this to display everything
    }
}