import { SCHEMA } from './schema'
import { SqlightDatabase } from './db'

const BearSchema = SCHEMA({
    tables: {
        ZSFNOTE: {
            columns: {
                Z_PK: { type: 'INTEGER', pk: true },
                Z_INT: { type: 'INTEGER' },
                Z_OPT: { type: 'INTEGER' },
                ZUNIQUEIDENTIFIER: { type: 'VARCHAR' },
                ZARCHIVED: { type: 'INTEGER' },
                ZENCRYPTED: { type: 'INTEGER' },
                ZHASFILES: { type: 'INTEGER' },
                ZHASIMAGES: { type: 'INTEGER' },
                ZVERSION: { type: 'INTEGER' },
                ZLOCKED: { type: 'INTEGER' },
                ZORDER: { type: 'INTEGER' },
                ZPERMANENTLYDELETED: { type: 'INTEGER' },
                ZTRASHED: { type: 'INTEGER' },
                ZPINNED: { type: 'INTEGER' },

                ZCREATIONDATE: { type: 'TIMESTAMP' },
                ZMODIFICATIONDATE: { type: 'TIMESTAMP' },
                ZTRASHEDDATE: { type: 'TIMESTAMP' },

                ZCONFLICTUNIQUEIDENTIFIERDATE: { type: 'TIMESTAMP' },
                ZCONFLICTUNIQUEIDENTIFIER: { type: 'VARCHAR' },

                ZSUBTITLE: { type: 'VARCHAR' },
                ZTEXT: { type: 'VARCHAR' },
                ZTITLE: { type: 'VARCHAR' },
            }
        }
    }
})

export class BearDatabase extends SqlightDatabase {

}