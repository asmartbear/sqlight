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
        },
        ZSFNOTETAG: {
            columns: {
                Z_PK: { type: 'INTEGER', pk: true },
                ZISROOT: { type: 'BOOLEAN' },
                ZTITLE: { type: 'VARCHAR' },
            }
        },
        Z_5TAGS: {
            columns: {
                Z_5NOTES: { type: 'INTEGER' },
                Z_13TAGS: { type: 'INTEGER' },
            }
        },
        ZSFNOTEFILE: {
            columns: {
                Z_PK: { type: 'INTEGER', pk: true },
                ZPERMANENTLYDELETED: { type: 'BOOLEAN' },
                ZDOWNLOADED: { type: 'BOOLEAN' },
                ZUPLOADED: { type: 'BOOLEAN' },
                ZFILESIZE: { type: 'INTEGER' },
                ZNOTE: { type: 'INTEGER' },
                ZNORMALIZEDFILEEXTENSION: { type: 'VARCHAR' },
                ZFILENAME: { type: 'VARCHAR' },
                ZUNIQUEIDENTIFIER: { type: 'VARCHAR' },
                ZCREATIONDATE: { type: 'TIMESTAMP' },
                ZMODIFICATIONDATE: { type: 'TIMESTAMP' },
                ZSEARCHTEXT: { type: 'VARCHAR' },
            }
        },
    }
})

/** Bear attachment on disk that is related to a Note */
export class BearSqlAttachment {

}

/** Post-processed note from Bear */
export class BearSqlNote {
    constructor(
        public readonly database: BearSqlDatabase,
        private readonly row: {
            Z_PK: number,
            ZUNIQUEIDENTIFIER: string,
            ZTITLE: string,
            ZTEXT: string,
            ZCONFLICTUNIQUEIDENTIFIER: string,
            ZCREATIONDATE: number,
            ZMODIFICATIONDATE: number,
            isActive: boolean,
            hasAttachments: boolean,
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

    /** True if there are any kinds of file attachments on this note */
    get hasAttachments(): boolean {
        return this.row.hasAttachments
    }

    toString(): string {
        return `${this.pk}/${this.uniqueId}${this.isActive ? '' : '[inactive]'}${this.isInConflict ? '!!!' : ''}${this.hasAttachments ? '+++' : ''}: ${this.title} on ${this.modifiedOn}`
    }
}

/** Options for how to query notes in Bear. */
export type BearNoteQueryOptions = {
    /** Maximum number of notes to return */
    limit: number
    /** Limit to the note with this unique identifier */
    uniqueId?: string
    /** Only notes where the title exactly equals this */
    titleExact?: string
    /** Only notes that contain at least one of these tags */
    tagsInclude?: string[]
    /** Only notes that do not contain any of these tags */
    tagsExclude?: string[]
    /** How to order the returned notes. */
    orderBy?: 'newest' | 'oldest'
    /** Normally inactive notes are ignored, but you can include them. */
    includeInactive?: boolean
    /** Normally conflicted notes are ignored, but you can include them. */
    includeInConflict?: boolean
}

/** Information about a tag in Bear, */
export type BearTag = {
    id: number,
    name: string,
}

/** A Sqlite database, specifically for Bear, allowing arbitrary queries but also some useful built-ins. */
export class BearSqlDatabase extends SqlightDatabase<TablesOf<typeof BearSchema>> {
    constructor() {
        super(BearSchema, `${process.env.HOME}/Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data/database.sqlite`)
    }

    /** Retrieves all tags in the system */
    getTags(): Promise<BearTag[]> {
        const shell = this.select()
        const tags = shell.from('t', 'ZSFNOTETAG')
        const q = shell
            .select('id', tags.col.Z_PK)
            .select('name', tags.col.ZTITLE)
        return this.selectAll(q)
    }

    /** Queries for notes in Bear, returning structured objects with additional abilities. */
    async getNotes(options: BearNoteQueryOptions) {
        const shell = this.select()
        const notes = shell.from('n', 'ZSFNOTE').col
        const isActive = OR(notes.ZARCHIVED, notes.ZTRASHED, notes.ZPERMANENTLYDELETED).not()
        const q = shell
            .passThrough(notes.Z_PK)
            .passThrough(notes.ZUNIQUEIDENTIFIER)
            .passThrough(notes.ZTITLE)
            .passThrough(notes.ZTEXT)
            .passThrough(notes.ZCONFLICTUNIQUEIDENTIFIER)
            .passThrough(notes.ZCREATIONDATE)
            .passThrough(notes.ZMODIFICATIONDATE)
            .passThrough(notes.ZMODIFICATIONDATE)
            .select('isActive', isActive)
            .select('hasAttachments', notes.ZHASFILES.or(notes.ZHASIMAGES))

        // Apply various filters
        if (!options.includeInactive) {
            q.where(isActive)
        }
        if (!options.includeInConflict) {
            q.where(notes.ZCONFLICTUNIQUEIDENTIFIER.isNull())
        }
        if (options.uniqueId) {
            q.where(notes.ZUNIQUEIDENTIFIER.eq(options.uniqueId))
        }
        if (options.titleExact) {
            q.where(notes.ZTITLE.eq(options.titleExact))
        }

        // Apply tags
        if (options.tagsInclude && options.tagsInclude.length > 0) {
            const start = this.select()
            const tags = start.from('t', 'ZSFNOTETAG').col
            const mapping = start.from('m', 'Z_5TAGS', 'JOIN', m => m.col.Z_13TAGS.eq(tags.Z_PK)).col
            const sub = start.passThrough(mapping.Z_5NOTES)
            sub.where(tags.ZTITLE.inList(options.tagsInclude))
            q.where(notes.Z_PK.inSubquery(sub.asSubquery('Z_5NOTES')))
        }
        if (options.tagsExclude && options.tagsExclude.length > 0) {
            const start = this.select()
            const tags = start.from('t', 'ZSFNOTETAG').col
            const mapping = start.from('m', 'Z_5TAGS', 'JOIN', m => m.col.Z_13TAGS.eq(tags.Z_PK)).col
            const sub = start.passThrough(mapping.Z_5NOTES)
            sub.where(tags.ZTITLE.inList(options.tagsExclude))
            q.where(notes.Z_PK.inSubquery(sub.asSubquery('Z_5NOTES')).not())
        }

        // Apply ordering
        switch (options.orderBy) {
            case 'newest': q.orderBy(notes.ZMODIFICATIONDATE, 'DESC'); break
            case 'oldest': q.orderBy(notes.ZMODIFICATIONDATE, 'ASC'); break
        }

        // Run the query
        q.setLimit(options.limit)
        console.log(q.toSql())
        const rows = await this.selectAll(q)
        return rows.map(r => new BearSqlNote(this, r))
    }

    /** 
     * Extracts one note by its unique ID, or `undefined` if we can't find it. 
     * 
     * Unlike the default search, will include inactive and conflicted notes, since you were
     * looking for a specific one.
     */
    async getNoteByUniqueId(uniqueId: string): Promise<BearSqlNote | undefined> {
        return (await this.getNotes({ limit: 1, uniqueId, includeInactive: true, includeInConflict: true }))[0]
    }
}

(async () => {
    const db = new BearSqlDatabase()
    console.log(await db.getTables())
    const result = await db.getNotes({
        limit: 5,
        orderBy: 'newest',
        tagsInclude: ['book/idea'],
    })
    await db.close()
    return result.map(x => x.toString())
})().then(console.log)