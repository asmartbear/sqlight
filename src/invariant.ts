// invariant.ts
import * as tiny from "tiny-invariant";
export const invariant: (condition: any, msg?: string) => asserts condition =
    // ESM build
    (tiny as any).default
    // CJS build (Jest)
    || (tiny as any);