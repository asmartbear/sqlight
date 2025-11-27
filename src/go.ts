import invariant from "tiny-invariant"
import { BearSqlDatabase } from "./bear"
import { randomUUID } from "crypto"

(async () => {
    const db = BearSqlDatabase.singleton()
    // console.log(await db.getTables())

    // Notes
    // const filter: BearNoteQueryOptions = {
    //     limit: 10,
    //     includes: "Jira",
    //     orderBy: 'newest',
    //     // modifiedAfter: new Date(2025, 10, 19),
    // }
    // const notes = await db.getNotes(filter)
    // console.log(notes.map(String))
    // console.log(await Promise.all(notes.map(x => x.getTags())))

    //     await notes[0].appendFile(Path.userHomeDir.join("Downloads", "skate.pdf"))
    //     await notes[0].appendFile("tacos are good", "tacos.txt")

    // console.log(await db.getNoteUniqueIDs(filter))

    //     // Attachments
    //     for (const note of notes) {
    //         for (const att of await note.getAttachments()) {
    //             console.log(att.toString())
    //         }
    //     }

    // Get structured information from a note
    let note = await db.getNoteByUniqueId('E9FB660C-5554-4B43-8909-EC75C2A75792')
    invariant(note)
    console.log(await note.getTags())
    const frontMatter: { baz: number } = note.frontMatter as any
    note.h1 += '!'
    frontMatter.baz += 1
    note = await note.save(true)
    note.append("\n" + randomUUID())

    // Create a note
    // const note = await db.createNote(['home'])
    // note.h1 = 'Made in test'
    // note.body = 'Something is here now!'
    // note.frontMatter.foo = 123
    // await note.save()

    await db.close()
    return "done"
})().then(console.log)