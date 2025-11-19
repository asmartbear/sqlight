
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