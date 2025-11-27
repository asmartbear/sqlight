import { Nullish } from "./types"

function _byteToUriChars(b: number): string {
    // Already fine
    if ((b >= 97 && b <= 122) || (b >= 65 && b <= 90) || (b >= 48 && b <= 57) || b == 95 || b == 45) return String.fromCharCode(b)
    // Needs padding?
    if (b < 16) return '%0' + b.toString(16)
    // Already two-digit
    return '%' + b.toString(16)
}

function _byteToUriPathChars(b: number): string {
    // Already fine
    if ((b >= 97 && b <= 122) || (b >= 65 && b <= 90) || (b >= 48 && b <= 57) || b == 95 || b == 45 || b == 47 || b == 58 || b == 46) return String.fromCharCode(b)
    // Needs padding?
    if (b < 16) return '%0' + b.toString(16)
    // Already two-digit
    return '%' + b.toString(16)
}

// like encodeURIComponent() but also things like single-quote characters and UTF-8 characters, which was messing us up before.
export function betterEncodeUriComponent(s: string): string {
    const bytes = new TextEncoder().encode(s)
    return Array.from(bytes).map(_byteToUriChars).join('')
}

/**
 * Yields the processor for some given ms (can be `0`) while some condition is false or null or undefined.
 * Will not yield at all if the condition is already true.
 * Function can be promise-based or not
 */
export async function busyWait<T>(msBetween: number, fIsReady: () => T | false | Nullish | Promise<T | false | Nullish>, timeoutMs: number = 60000): Promise<T> {
    const tStart = Date.now()
    while (Date.now() - tStart < timeoutMs) {
        const x = await fIsReady()
        if (x) return x
        await new Promise(resolve => setTimeout(resolve, msBetween))
    }
    throw new Error("busyWait: timed out")
}

/**
 * Given a set of tags in the form 'foo/bar', of any number of path components, deletes any "parent",
 * meaning any tag that is strictly a parent of another given tag, returning the resulting new array.
 */
export function removeParentTags(tags: string[]): string[] {
    // Look for any tag that is a parent-like prefix of another tag
    const result: string[] = []
    for (const tag of tags) {
        const parentPrefix = tag + '/'        // if any other tag starts with this, we are a parent and should be skipped
        if (!tags.find(t => t.startsWith(parentPrefix))) {
            result.push(tag)
        }
    }
    return result
}

export function isNonEmptyArray<T>(x: T[] | Nullish): x is T[] {
    return Array.isArray(x) && x.length > 0
}

export function objectLength(x: any): number {
    return x ? Object.keys(x).length : 0
}
