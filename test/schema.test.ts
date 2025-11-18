import * as T from "./testutil"
import { SchemaDatabase } from "../src/types"
import { EXPR } from "../src/expr"
import { SCHEMA } from "../src/schema"

const testSchema = SCHEMA({
    tables: {
        user: {
            columns: {
                id: { type: 'INTEGER', pk: true },
                login: { type: 'TEXT' },
                apiKey: { type: 'TEXT', nullable: true },
                isAdmin: { type: 'BOOLEAN' },
            }
        }
    }
})

test('integers from INT', () => {
    const table = testSchema.from("user", "u")
    const id = table.col('id')
    T.be(id.columnName, "id")
    T.be(id.type, "INTEGER")
    T.be(id.canBeNull(), false)
    T.be(id.toSql(), "u.id")
})
