import { exec } from 'child_process';
import { randomUUID } from 'crypto';

import { SCHEMA, SqlJoinType, SqlSelect, TablesOf } from './schema'
import { SqlightDatabase } from './db'
import { OR } from './expr'
import { betterEncodeUriComponent, busyWait, isNonEmptyArray, objectLength, removeParentTags } from './util'
import { Nullish } from './types';
import { parseYaml, toYamlString, YamlStruct } from './yaml';
import { Path } from '@asmartbear/filesystem';

const BEAR_EPOCH = 978307200

function bearTimestampToDate(ts: number): Date {
    // The epoch for timestamps in the Bear database is 1 Jan 2001, so we
    // need to add the following offset to the timestamps to get a unix timestamp
    return new Date((ts + BEAR_EPOCH) * 1000)
}

function dateToBearTimestamp(d: Date): number {
    // The epoch for timestamps in the Bear database is 1 Jan 2001, so we
    // need to add the following offset to the timestamps to get a unix timestamp
    return ((d.getTime() + 1) / 1000.0) - BEAR_EPOCH
}

/**
 * Run an `xcall` URL, without waiting for it to complete.
 */
function bearXCall(cmd: string, args?: Record<string, string>) {
    let urlArgs = ''
    const argList = args ? Object.entries(args) : []
    if (argList.length > 0) {
        urlArgs = '?' + argList.map(pair => `${betterEncodeUriComponent(pair[0])}=${betterEncodeUriComponent(pair[1])}`).join('&')
    }
    const url = `bear://x-callback-url/${cmd}${urlArgs}`
    exec(`open '${url}'`)
}

function openCmd(path: string) {
    exec(`open '${path}'`);
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
                ZCREATIONDATE: { type: 'REAL' },
                ZMODIFICATIONDATE: { type: 'REAL' },
                ZSEARCHTEXT: { type: 'VARCHAR' },
            }
        },
    }
})

/** Bear attachment on disk that is related to a Note */
export class BearSqlAttachment {

    /** Full path to the attachment on disk */
    public readonly path: Path

    constructor(
        private readonly row: {
            ZUNIQUEIDENTIFIER: string,
            ZFILENAME: string,
            ZNORMALIZEDFILEEXTENSION: string,
            ZCREATIONDATE: number,
            ZMODIFICATIONDATE: number,
        }
    ) {
        this.path = BearSqlDatabase.SHINY_FROG_APPLICATION_DATA_PATH.join("Local Files", row.ZNORMALIZEDFILEEXTENSION.match(/^(?:jpe?g|png|gif|heic|jpg|tiff|webp)$/) ? "Note Images" : "Note Files", row.ZUNIQUEIDENTIFIER, row.ZFILENAME)
    }

    /** The name of the uploaded file without the rest of the path, also as mapped into the note */
    get filename(): string {
        return this.row.ZFILENAME
    }

    /** The normalized file extension of the filename */
    get extension(): string {
        return this.row.ZNORMALIZEDFILEEXTENSION
    }

    /** Gets the date this attachment was created. */
    get createdOn(): Date {
        return bearTimestampToDate(this.row.ZCREATIONDATE)
    }

    /** Gets the date this attachment was last modified. */
    get modifiedOn(): Date {
        return bearTimestampToDate(Math.max(this.row.ZCREATIONDATE, this.row.ZMODIFICATIONDATE))
    }

    toString(): string {
        return this.path.toString()
    }
}

/** The data from the standard SQL query for a note */
export type BearNoteSqlRowData = {
    Z_PK: number,
    ZUNIQUEIDENTIFIER: string,
    ZTITLE: string,
    ZTEXT: string,
    ZCONFLICTUNIQUEIDENTIFIER: string | null,
    ZCREATIONDATE: number,
    ZMODIFICATIONDATE: number,
    isActive: boolean,
    hasAttachments: boolean,
}

/** Post-processed note from Bear */
export class BearSqlNote {

    /** The body-content of the note, excluding YAML header, H1, and tags. */
    public body: string

    /** The H1 title inside the note, which may not match the database title because it can be inferred or otherwise computed */
    public h1: string | undefined

    /** The YAML header of the note, which might be an empty structure if it's missing. */
    public frontMatter: YamlStruct

    constructor(
        public readonly database: BearSqlDatabase | null,
        private readonly row: BearNoteSqlRowData
    ) {
        // Parse out the front matter
        const ym = parseYaml(row.ZTEXT)
        this.body = ym.text.trim()
        this.frontMatter = ym.data

        // Remove the H1 if it's there
        {
            const m = this.body.match(/^#\s+([^\n]*)\n/m)
            if (m) {
                this.h1 = m[1].trim()
                this.body = this.body.replace(/^#\s+([^\n])*\n/m, '').trimStart()
            }
        }

        // Remove body tags if they're there
        this.body = this.body.replaceAll(/^#[a-zA-Z][\w\/-]+(?:\n|$)/mg, '').trim()
    }

    /** Creates a disconnected "fake" note, that will throw exceptions if you try to use functions that access a database. */
    static makeFakeNote(row: BearNoteSqlRowData): BearSqlNote {
        return new BearSqlNote(null, row)
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
        return this.row.ZTITLE
    }

    /** The raw, unprocessed content of the note, including the H1 that might replicate the title and including tags. */
    get rawContent(): string {
        return this.row.ZTEXT
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

    /** Deep-link URL to the note inside the Bear app */
    get deepLinkUrl(): string {
        return `bear://x-callback-url/open-note?id=${this.uniqueId}`
    }

    /** True if there are any kinds of file attachments on this note */
    get hasAttachments(): boolean {
        return this.row.hasAttachments
    }

    toString(): string {
        return `${this.pk}/${this.uniqueId}${this.isActive ? '' : '[inactive]'}${this.isInConflict ? '!!!' : ''}${this.hasAttachments ? '+++' : ''}: ${this.title} on ${this.modifiedOn}`
    }

    /** Loads the list of tags associated with this note in the database */
    async getTags(): Promise<Set<string>> {
        if (!this.database) throw new Error("BearSqlNote.getTags() requires a live database.")
        const start = this.database.select()
        const map = start.from('m', 'Z_5TAGS').col
        const tags = start.from('t', 'ZSFNOTETAG', 'JOIN', t => t.col.Z_PK.eq(map.Z_13TAGS)).col
        const q = start
            .select('name', tags.ZTITLE)
            .where(map.Z_5NOTES.eq(this.pk))
        const rows = await this.database.selectAll(q)
        const tagList = rows.map(row => row.name)
        return new Set(removeParentTags(tagList))
    }

    /** Loads list of note-attachments from the database, but only if they have been downloaded locally. */
    async getAttachments(): Promise<BearSqlAttachment[]> {
        if (!this.hasAttachments) return []          // only if there are any
        if (!this.database) throw new Error("BearSqlNote.getAttachments() requires a live database (if there are attachments).")
        const start = this.database.select()
        const att = start.from('a', 'ZSFNOTEFILE').col
        const q = start
            .passThrough(att.ZUNIQUEIDENTIFIER)
            .passThrough(att.ZFILENAME)
            .passThrough(att.ZNORMALIZEDFILEEXTENSION)
            .passThrough(att.ZCREATIONDATE)
            .passThrough(att.ZMODIFICATIONDATE)
            .where(att.ZNOTE.eq(this.row.Z_PK))
            .where(att.ZPERMANENTLYDELETED.not())
            .where(att.ZDOWNLOADED)
        const rows = await this.database.selectAll(q)
        return rows.map(row => new BearSqlAttachment(row))
    }

    /** If you've modified body, H1, or front-matter, saves that back to Bear in the background. */
    async save(): Promise<void> {
        if (!this.database) throw new Error("BearSqlNote.save() requires a live database.")
        const tags = await this.getTags()
        this.setRawContent(BearSqlNote.createStructuredContent(this.h1, this.body, Array.from(tags), this.frontMatter), 'replace_all')
    }

    /** Appends content to a note, in memory and in Bear.  No other changes will be saved! */
    append(txt: string) {
        if (!this.database) throw new Error("BearSqlNote.append() requires a live database.")
        this.body += txt
        this.setRawContent(txt, 'append')
    }

    /**
     * Computes complete Bear note content given inputs in pieces.
     * 
     * Implemented as a public static method for unit-testing.
     * 
     * @param title The (optional) title for the note
     * @param body The (optional) markdown-formatted body of the note
     * @param tags The (optional) list of tags to apply to the note
     * @param meta The (optional) YAML-compatible meta-data to add to the top of the note
     */
    static createStructuredContent(title: string | Nullish, body: string | Nullish, tags: string[] | Nullish = undefined, frontMatter: YamlStruct | Nullish = undefined): string {
        const tagContent = isNonEmptyArray(tags) ? "\n" + tags.map(tag => '#' + tag + "\n").join('') : ""
        const metaContent = (frontMatter && objectLength(frontMatter) > 0) ? "---\n" + toYamlString(frontMatter) + "---\n\n" : ""
        const titleContent = title ? `# ${title.trim()}\n\n` : ""
        const bodyContent = body ? body.trimEnd() + "\n" : ""
        return metaContent + titleContent + bodyContent + tagContent
    }

    /**
     * Updates the text of this note.  Happens in the background; you can't tell exactly when it will complete, but usually within a few seconds.  The local in-memory object updates immediately.
     * 
     * @param content to append, prepend, or replace; if full replacement, you might want to use `BearSqlNote.createStructuredContent()` to produce it.
     * @param mode How to update the text.  `replace` means everything but the title; `replace_all` includes the title.
     * @param openNewNote If true, physically opens the note in the Bear app
     */
    setRawContent(content: string, mode: "prepend" | "append" | "replace" | "replace_all") {
        if (!this.database) throw new Error("BearSqlNote.setRawContent() requires a live database.")
        // Ref: https://bear.app/faq/x-callback-url-scheme-documentation/#add-text
        bearXCall("add-text", {
            id: this.uniqueId,
            text: content,
            mode: mode,
            show_window: "no",
        })
        this.row.ZTEXT = content
    }

    /** Opens this note in the Bear application */
    openInBear(inNewWindow: boolean) {
        if (!this.database) throw new Error("BearSqlNote.openInBear() requires a live database.")
        // Ref: https://bear.app/faq/x-callback-url-scheme-documentation/#open-note
        bearXCall("open-note", {
            id: this.uniqueId,
            show_window: "yes",
            new_window: inNewWindow ? "yes" : "no",
        })
    }

    /**
     * Deletes this note inside the Bear app.
     * Really moves it to the Trash, so it's still available, manually
     */
    deleteInBear() {
        if (!this.database) throw new Error("BearSqlNote.deleteInBear() requires a live database.")
        // Ref: https://bear.app/faq/x-callback-url-scheme-documentation/#trash
        bearXCall("trash", {
            id: this.uniqueId,
            show_window: "no",
        })
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
    /** Only notes with modification dates newer than this */
    modifiedAfter?: Date
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

    /** Path to the "Application Data" directory for Bear App. */
    static SHINY_FROG_APPLICATION_DATA_PATH = Path.userHomeDir.join(`Library/Group Containers/9K33E3U3T4.net.shinyfrog.bear/Application Data`)

    /** Private to force you through the singleton */
    private constructor() {
        super(BearSchema, BearSqlDatabase.SHINY_FROG_APPLICATION_DATA_PATH.join(`/database.sqlite`))
    }

    private static _singleton: BearSqlDatabase | null = null

    /** Global singleton, to ensure global mutex on the database.  Database is not opened unless accessed. */
    static singleton(): BearSqlDatabase {
        if (!BearSqlDatabase._singleton) {
            BearSqlDatabase._singleton = new BearSqlDatabase()
        }
        return BearSqlDatabase._singleton
    }

    /**
     * Creates a new generic Bear note.
     * 
     * @param content The raw content of the note; recommmend using `BearSqlNote.createStructuredContent()` to produce this.
     * @param openNewNote If true, physically opens the note in the Bear app
     */
    static createNote(content: string, openNewNote: boolean) {
        bearXCall("create", {
            text: content,
            open_note: openNewNote ? "yes" : "no",
            show_window: openNewNote ? "yes" : "no",
            new_window: openNewNote ? "yes" : "no",
        })
        if (openNewNote) {
            openCmd('/Applications/Bear.app')
        }
    }

    /**
     * Creates a new note with the given content, then waits for it to appear in the database,
     * then returns the database record.  This allows you to know things like its unique ID.
     */
    async createAndReturnNote(content: string): Promise<BearSqlNote> {
        // Create a note with bogus, uniquely identifiable content
        const tempTitle = `New note ${randomUUID()}`
        BearSqlDatabase.createNote(`# ${tempTitle}\n\n`, false)
        // Wait for it to appear
        const note = await busyWait(100, () => this.getNoteByTitle(tempTitle))
        // Replace its content with the right content
        note.setRawContent(content, 'replace_all')
        return note
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

    /**
     * Constructs a `SqlSelect` object and 'notes' tables, applying a range of options, but
     * not yet adding any select columns, so the caller can decide which fields it is interested in,
     * and make other changes to the query before submitting it.
     * 
     * @returns `{select: SqlSelect, notes: {[col]:Sql}, isActive: Sql }`
     */
    getNoteSelect(options: BearNoteQueryOptions) {
        const q = this.select()
        const notes = q.from('n', 'ZSFNOTE').col
        const isActive = OR(notes.ZARCHIVED, notes.ZTRASHED, notes.ZPERMANENTLYDELETED).not()

        // Apply simple filters
        q.setLimit(options.limit)
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
        if (options.modifiedAfter) {
            q.where(notes.ZMODIFICATIONDATE.gt(dateToBearTimestamp(options.modifiedAfter)))
        }

        // Apply tags
        if (isNonEmptyArray(options.tagsInclude)) {
            const start = this.select()
            const tags = start.from('t', 'ZSFNOTETAG').col
            const mapping = start.from('m', 'Z_5TAGS', 'JOIN', m => m.col.Z_13TAGS.eq(tags.Z_PK)).col
            const sub = start.passThrough(mapping.Z_5NOTES)
            sub.where(tags.ZTITLE.inList(options.tagsInclude))
            q.where(notes.Z_PK.inSubquery(sub.asSubquery('Z_5NOTES')))
        }
        if (isNonEmptyArray(options.tagsExclude)) {
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

        // Done
        return { select: q, notes, isActive }
    }

    /** Queries for notes in Bear, returning structured objects with additional abilities. */
    async getNotes(options: BearNoteQueryOptions) {

        // Build the query
        const { select, notes, isActive } = this.getNoteSelect(options)
        const q = select
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


        // Run the query
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

    /** 
     * Extracts one note by its title, or `undefined` if we can't find it.
     * 
     * It's possible that multiple notes could match; we return the one that was modified most recently.
     */
    async getNoteByTitle(title: string): Promise<BearSqlNote | undefined> {
        return (await this.getNotes({ limit: 1, titleExact: title, orderBy: 'newest' }))[0]
    }

    /** Runs a query, returning a simple array of unique IDs of the notes that match. */
    async getNoteUniqueIDs(options: BearNoteQueryOptions): Promise<string[]> {
        const { select, notes } = this.getNoteSelect(options)
        const q = select
            .select('uid', notes.ZUNIQUEIDENTIFIER)
        return (await this.selectAll(q)).map(row => row.uid)
    }
}

// (async () => {
//     const db = BearSqlDatabase.singleton()
//     // console.log(await db.getTables())

//     //     // Notes
//     const filter: BearNoteQueryOptions = {
//         limit: 10,
//         orderBy: 'newest',
//         modifiedAfter: new Date(2025, 10, 19),
//     }
//     const notes = await db.getNotes(filter)
//     console.log(await Promise.all(notes.map(x => x.getTags())))

// console.log(await db.getNoteUniqueIDs(filter))

//     // Attachments
//     for (const note of notes) {
//         for (const att of await note.getAttachments()) {
//             console.log(att.toString())
//         }
//     }

// Get structured information from a note
// let note = await db.getNoteByUniqueId('008233D4-87F8-40E5-9114-E91F58E527DB')
// invariant(note)
// console.log(await note.getTags())
// const frontMatter: { baz: number } = note.frontMatter as any
// note.h1 += '!'
// frontMatter.baz += 1
// note.save()
// note.append("\n" + randomUUID())

// Create a note
// const newNote = await db.createAndReturnNote(BearSqlNote.createStructuredContent(
//     "This is better",
//     "This is the content I always wished I could have.",
//     ['home'],
//     { foo: "bar", baz: 321 }
// ))
// console.log(newNote.toString())

//     await db.close()
//     return "done"
// })().then(console.log)