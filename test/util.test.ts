import * as T from "@asmartbear/testutil"
import * as U from "../src/util"

test('integers from INT', () => {
    T.eq(U.removeParentTags([]), [])
    T.eq(U.removeParentTags(['foo']), ['foo'])
    T.eq(U.removeParentTags(['foo', 'bar']), ['foo', 'bar'])
    T.eq(U.removeParentTags(['foo', 'foo/bar']), ['foo/bar'])
    T.eq(U.removeParentTags(['foo/bar/baz', 'foo', 'foo/bar']), ['foo/bar/baz'])
    T.eq(U.removeParentTags(['foo/bar/baz', 'bar', 'foo', 'foo/bar']), ['foo/bar/baz', 'bar'])
    T.eq(U.removeParentTags(['foo/bar/baz', 'bar', 'foo', 'foo/bar', 'bar/foo']), ['foo/bar/baz', 'bar/foo'])
})