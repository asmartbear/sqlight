import { SCHEMA, TablesOf } from './schema'
import { SqlightDatabase } from './db'
import { OR } from './expr'

function bearTimestampToDate(ts: number): Date {
    // The epoch for timestamps in the Bear database is 1 Jan 2001, so we
    // need to add the following offset to the timestamps to get a unix timestamp
    return new Date((ts + 978307200) * 1000)
}

const BearSchema = SCHEMA({
    tables: {
        ZSFNOTE: {
            columns: {
                Z_PK: { type: 'INTEGER', pk: true },
                // Z_ENT: { type: 'INTEGER' },
                // Z_OPT: { type: 'INTEGER' },
                ZUNIQUEIDENTIFIER: { type: 'VARCHAR' },
                ZARCHIVED: { type: 'BOOLEAN' },
                ZENCRYPTED: { type: 'BOOLEAN' },
                ZHASFILES: { type: 'BOOLEAN' },
                ZHASIMAGES: { type: 'BOOLEAN' },
                // ZVERSION: { type: 'INTEGER' },
                ZLOCKED: { type: 'BOOLEAN' },
                // ZORDER: { type: 'INTEGER' },
                ZPERMANENTLYDELETED: { type: 'BOOLEAN' },
                ZTRASHED: { type: 'BOOLEAN' },
                ZPINNED: { type: 'BOOLEAN' },

                ZCREATIONDATE: { type: 'REAL' },
                ZMODIFICATIONDATE: { type: 'REAL' },
                ZTRASHEDDATE: { type: 'REAL' },
                ZARCHIVEDDATE: { type: 'REAL', nullable: true },

                ZCONFLICTUNIQUEIDENTIFIERDATE: { type: 'REAL', nullable: true },
                ZCONFLICTUNIQUEIDENTIFIER: { type: 'VARCHAR', nullable: true },

                // ZSUBTITLE: { type: 'VARCHAR' },
                ZTEXT: { type: 'VARCHAR' },
                ZTITLE: { type: 'VARCHAR' },
            }
        }
    }
})

/** Post-processed note from Bear */
export class BearSqlNote {
    constructor(
        private readonly row: {
            Z_PK: number,
            ZUNIQUEIDENTIFIER: string,
            ZTITLE: string,
            ZTEXT: string,
            isActive: boolean,
            ZCONFLICTUNIQUEIDENTIFIER: string,
            ZCREATIONDATE: number,
            ZMODIFICATIONDATE: number,
        }
    ) {
    }

    /** The database-unique primary key of this note */
    get pk(): number {
        return this.row.Z_PK
    }

    /** The globally-unique identifier for this note, though it can change if you restore from backup. */
    get uniqueId(): string {
        return this.row.ZUNIQUEIDENTIFIER
    }

    /** The title of the note as extracted into the database, not looking directly at the H1. */
    get title(): string {
        return this.row.ZTITLE.trim()
    }

    /** The content of the note including the H1 that might replicate the title and including tags. */
    get content(): string {
        return this.row.ZTEXT.trim()
    }

    /** True if this note hasn't been archived or deleted. */
    get isActive(): boolean {
        return this.row.isActive
    }

    /** True if this note is in a "conflicted" state due to synchronization issues. */
    get isInConflict(): boolean {
        return !!this.row.ZCONFLICTUNIQUEIDENTIFIER
    }

    /** Gets the date this note was created. */
    get createdOn(): Date {
        return bearTimestampToDate(this.row.ZCREATIONDATE)
    }

    /** Gets the date this note was last modified. */
    get modifiedOn(): Date {
        return bearTimestampToDate(Math.max(this.row.ZCREATIONDATE, this.row.ZMODIFICATIONDATE))
    }

    toString(): string {
        return `${this.pk}/${this.uniqueId}${this.isActive ? '' : '[inactive]'}${this.isInConflict ? '!!!' : ''}: ${this.title} on ${this.modifiedOn}`
    }
}

/** A Sqlite database, specifically for Bear, allowing arbitrary queries but also some useful built-ins. */
export class BearSqlDatabase extends SqlightDatabase<TablesOf<typeof BearSchema>> {
    constructor() {
        super(BearSchema, `${process.env.HOME}/Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data/database.sqlite`)
    }

    async getNotes() {
        const shell = this.select()
        const notes = shell.from('n', 'ZSFNOTE')
        const q = shell
            .passThrough(notes.col.Z_PK)
            .passThrough(notes.col.ZUNIQUEIDENTIFIER)
            .passThrough(notes.col.ZTITLE)
            .passThrough(notes.col.ZTEXT)
            .passThrough(notes.col.ZCONFLICTUNIQUEIDENTIFIER)
            .passThrough(notes.col.ZCREATIONDATE)
            .passThrough(notes.col.ZMODIFICATIONDATE)
            .select('isActive', OR(notes.col.ZARCHIVED, notes.col.ZTRASHED, notes.col.ZPERMANENTLYDELETED).not())
        q.setLimit(10).orderBy(notes.col.ZMODIFICATIONDATE, 'DESC')
        const rows = await this.selectAll(q)
        console.log(q.toSql())
        return rows.map(r => new BearSqlNote(r).toString())
    }
}

(async () => {
    const db = new BearSqlDatabase()
    const result = await db.getNotes()
    await db.close()
    return result
})().then(console.log)