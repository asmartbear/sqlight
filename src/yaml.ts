import * as yaml from 'js-yaml';
import matter from 'gray-matter';

/**
 * Data types that are allowed in YAML structures.  This is similar to JSON but includes dates.
 */
export type YamlType = null | boolean | number | string | Date | YamlType[] | { [key: string]: YamlType };

/**
 * YAML structure, which is a key-valued structure pointing to any (nestable) YAML type.
 */
export type YamlStruct = { [key: string]: YamlType };

/**
 * Parses a YAML header out of a string, returning the content and the parsed data.
 * The header is always an object, but underneath that can be any Yaml-safe type nested.
 * If there isn't one, the text is unchanged, and the data is an empty non-null object (even if input is `null` or `undefined`.)
 * Content is left-trimmed, even if there's no YAML header.
 * Dates are default interpreted in GMT
 */
export function parseYaml(txt: string | null | undefined): { text: string, data: YamlStruct } {
    if (!txt) return { text: "", data: {} }
    const parsed = matter(txt)
    return { text: parsed.content.trimStart(), data: parsed.data }
}

/**
 * Converts anything YAML-compatible to a YAML string
 */
export function toYamlString(obj: YamlType): string {
    return yaml.dump(obj, { lineWidth: 99999, noRefs: true })
}