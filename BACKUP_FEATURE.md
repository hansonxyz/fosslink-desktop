# Backup / Export All — Feature Plan

Scoped to **Text Message Backup** (option 1 of the five) for initial implementation.
Photo Gallery Backup options (Gallery / Screenshots / All Images / Filesystem) are
queued for a later pass and not covered here.

## User flow

1. User opens **Settings → Extras → Backup / Export All**.
2. Selects option 1 (*Export threads as …*), picks a format (Text / XML / HTML),
   ticks or unticks *Include MMS images and video*.
3. Clicks **Export As…** → directory picker.
4. If the picked directory is non-empty, the renderer shows a confirm dialog
   warning that existing files may be overwritten. User confirms or cancels.
5. Renderer transitions to a **progress view** and sends `backup.threads_start`
   to the daemon. View shows:
   - A percentage bar (0–100).
   - A console-like log area: fixed-height, ring buffer of up to 200 lines,
     `pointer-events: none` + `user-select: none` so the user cannot scroll or
     select; auto-scrolls to the bottom on each new line.
   - A **Cancel** button.
6. On completion: view shows a summary (X threads, Y messages, Z attachments
   written, time elapsed) and a **Close** button. Log area remains visible.
7. On cancel: view shows a **Delete incomplete backup? y/n** dialog. If the
   target directory was empty at the start, "yes" recursively removes the
   target directory. If the directory had pre-existing files, "yes" is not
   offered (we can't safely tell our files from the user's).

## Formats — txt, xml, and html

All three thread-export formats are implemented.

Each thread gets its own **folder** named after the participants. Inside
the folder live both the conversation file (`<name>.txt` or `<name>.xml`)
and all MMS attachments for that thread. This replaces the earlier
`<name>.txt` + `<name>_mms/` layout.

```
target/
  Alice/
    Alice.txt              ← or Alice.xml
    2026-04-22_14-35-07_part42_cat.jpg
    2026-04-22_18-02-14_part47_video.mp4
  Bob, Charlie/
    Bob, Charlie.xml
    ...
```

**Filename stem**:
- 1 other party: the party's name (e.g. `Alice.txt`).
- 2 other parties: `Alice, Bob.txt`.
- 3+ other parties: `Alice, Bob, and N more.txt` where `N` is the count of
  additional participants beyond the first two. This caps filename length
  for large group chats.

Sanitize for filesystem-legal characters on Win/Mac/Linux:
- Illegal: `<>:"/\|?*` and ASCII control chars.
- Replace with `_`.
- Trim leading/trailing whitespace and dots.
- Cap at 180 chars before the `.txt` extension to leave room for `_mms`
  suffix + platform limits (~260 chars on Windows).
- On name collision after sanitization, append ` (2)`, ` (3)`, etc.

File content starts with a **participants header** listing ALL parties
including the user:
```
(Theresa, You)

```

followed by one block per message:
```
[Sender] (Timestamp):
(attachment-filename.ext)   ← only if message has an attachment, one line per attachment
(Message body, possibly multi-line)

```

Rules:
- Header: `(Name1, Name2, ..., You)` — "You" is always last. All parties
  listed, not truncated (only the filename is truncated).
- `Sender`: `Me` for outgoing (`type=2`) — note we use `Me` per-message
  while the header uses `You` to match common chat-export conventions where
  a header addresses "you" but each message line is spoken in first person.
  Otherwise the contact's name, or the formatted phone number if unknown.
- `Timestamp`: `YYYY-MM-DD HH:MM:SS` in the user's local time zone.
- If the message body is empty (attachment-only), the body line is omitted
  but the blank separator line still follows.
- If the message has multiple attachments, each gets its own line before the
  body, in the order reported by the phone.
- Messages sorted chronologically (oldest first).

### MMS attachments

When *Include MMS images and video* is checked, attachments are saved
inside the same thread folder as the conversation file (see layout above).

Attachment filename pattern: `YYYY-MM-DD_HH-MM-SS_part<partId>_<original-or-generated>.ext`.
- `<original-or-generated>`: the phone-supplied `filename` if present and non-empty,
  otherwise `attachment` (the extension comes from the mime type).
- Extension: derived from mime type (`image/jpeg` → `.jpg`, `image/png` → `.png`,
  `video/mp4` → `.mp4`, etc.). Fallback: `.bin`.
- The filename in the `.txt` / `.xml` file references this exact string —
  since everything is in the same folder, it's a plain basename.

### XML structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<thread>
  <participants>
    <participant>Theresa</participant>
    <participant self="true">You</participant>
  </participants>
  <messages>
    <message direction="received">
      <sender>Theresa</sender>
      <timestamp>2026-04-22 14:35:07</timestamp>
      <body>Hey, look at this</body>
      <attachments>
        <attachment mime="image/jpeg">2026-04-22_14-35-07_part42_photo.jpg</attachment>
      </attachments>
    </message>
    <message direction="sent">
      <sender>Me</sender>
      <timestamp>2026-04-22 14:36:12</timestamp>
      <body>Cool!</body>
    </message>
  </messages>
</thread>
```

- `<participant self="true">You</participant>` marks the owner of the backup.
- `direction="sent"` / `"received"` lets an importer classify at a glance.
- `<body>` is omitted for attachment-only messages.
- `<attachments>` is omitted when there are none. MMS can have multiple
  attachments in one message, so `<attachment>` elements appear in order.
- Text content and attribute values are escaped per XML 1.0: `&amp;`, `&lt;`,
  `&gt;`, and `&quot;` for attributes. Control characters disallowed by XML
  (everything below `\x20` except tab/newline/carriage return) are stripped
  rather than escaped because they're invalid even as entities.

### HTML structure

HTML export is designed to open cleanly in any browser directly from the
filesystem (`file://` URL) — no server required. Includes:

- `target/index.html` — sidebar of threads (newest first) and an iframe on
  the right that loads a thread when you click it. Full-viewport layout
  (100vw × 100vh), sidebar scrolls, iframe fills the rest.
- `target/<threadname>/<threadname>.html` — the thread itself, rendered to
  resemble the app: left-aligned received bubbles, right-aligned sent
  bubbles, periodic timestamp separators on day change or 15+ min gap,
  contact avatar on the left of received bubbles.
- Attachments sit in the same folder as the `.html` file (per the folder
  layout above). Image MIME types are rendered as clickable `<img>`
  thumbnails linking to the full file via `target="_blank"`. Video and
  other binary types are shown as labeled file links.
- CSS is inlined in every HTML file so the export is fully self-contained
  and portable. Colors mirror the app's dark theme (same CSS variables).
- Index JavaScript is inlined in `index.html`. A single handler intercepts
  clicks on `.thread-item[data-src]` and sets `iframe.src`.

**"Include MMS images and video" is forced on** for HTML export and the
checkbox is disabled in the UI while HTML is selected — without the images
the thumbnails would be broken. Switching back to txt/xml restores the
user's previous preference.

### Contact photos

For each participant in a thread (excluding "You"), if the desktop has
already synced a contact photo (`ContactRow.photo_path` exists on disk),
it gets copied into the thread folder as `contact-<sanitized-name>.<ext>`.
The extension is derived from the contact's mime type when known,
falling back to the source file's extension or `.jpg`.

Contact photos are exported for **every** format (txt/xml/html). The HTML
export references them as avatars next to received messages.

### Attachment fetch logic

For each attachment to be written:

1. If the target file already exists at the export destination **and its size
   matches the phone-reported size**, skip (no copy, no download). This
   requires knowing the phone's size for every attachment up-front.
2. Else if the attachment is in the desktop's local cache (`downloaded=1` and
   `local_path` exists), copy it to the target and continue.
3. Else download it via `smsHandler.downloadAttachment(partId, messageId)`
   and copy to target. The downloaded file stays in the desktop's cache,
   same as if the user had viewed the thread in the main UI — so opening the
   thread afterward is instant and a re-export skips the download.

### New phone query — `attachments.sizes`

To support step 1 above, we add a new query that returns byte sizes for a
list of (partId, messageId) pairs, without downloading. Phone side reads the
size column from the MMS part table (or `File(path).length()` on the `_data`
file for older rows).

Request body:
```json
{ "items": [{"partId": 42, "messageId": 1234}, ...] }
```

Response item shape:
```json
[
  {"partId": 42, "messageId": 1234, "size": 548217},
  ...
]
```

Size of `-1` means "unknown / could not determine" (skip the optimization in
that case and fall through to cache-or-download logic).

This is an **additive** protocol change — it doesn't affect existing packet
schemas, so no `MIN_PEER_VERSION` bump is required; old phones will just
refuse the query and the desktop falls back to always downloading.

## Export pipeline (daemon side)

A new module, `src/backup/thread-export.ts`. Entry point:

```typescript
export async function exportThreads(options: {
  targetDir: string
  includeMedia: boolean
  queryClient: QueryClient
  db: DatabaseService
  smsHandler: SmsHandler
  onProgress: (p: { percent: number; line: string }) => void
  signal: AbortSignal
}): Promise<{ threadsWritten: number; messagesWritten: number; attachmentsWritten: number; errors: string[] }>
```

Steps:

1. **Preflight**: verify target dir exists + writable. Snapshot whether it is
   empty (stored on the daemon for the cancel-cleanup decision).
2. **Pull fresh thread list** from phone via `queryClient.query('threads.list')`.
3. **Pull fresh contacts** via `queryClient.query('contacts.list')` if needed
   for name resolution — or reuse `db.getAllContacts()` if the main sync is
   running. Build a normalized-phone → contact-name map.
4. For each thread (chronological by most recent activity, doesn't really
   matter):
   - Emit progress: "Exporting thread N of M — <name>".
   - Query `threads.messages` (no date filter) → full message list.
   - Compute sanitized filename + collision disambiguation.
   - Build text content: for each message, assemble the block described above.
     Attachment filenames get generated here even before fetching bytes.
   - If `includeMedia`:
     - Collect all (partId, messageId, targetFilename) triples for this
       thread.
     - **Size query**: `queryClient.query('attachments.sizes', { items })` to
       get phone-reported sizes.
     - For each triple: apply the 3-step fetch logic (existing-match / cache /
       download-and-copy-then-evict).
   - Write the `.txt` file.
   - Check `signal.aborted` between threads and between attachments.
5. Emit final progress `percent: 100` + completion summary line.

Percent calculation: `(threadsDone + currentThreadProgress) / totalThreads * 100`.
Within a thread, progress is weighted by message count + attachment count to
avoid long pauses.

## IPC surface

New daemon IPC methods:

| Method | Params | Returns | Notes |
|---|---|---|---|
| `backup.check_folder` | `{ targetDir }` | `{ exists, empty, writable }` | For the overwrite-warning dialog. |
| `backup.threads_start` | `{ targetDir, format, includeMedia }` | `{ backupId }` | Fires and forget; progress comes via notifications. Only `format: "txt"` works at first. |
| `backup.cancel` | `{ backupId }` | `{ ok }` | Sets the AbortSignal. |
| `backup.delete_partial` | `{ backupId }` | `{ ok }` | Only honored if target dir was empty at start. |

New daemon → renderer notifications:

| Method | Params |
|---|---|
| `backup.progress` | `{ backupId, percent, line }` |
| `backup.complete` | `{ backupId, threadsWritten, messagesWritten, attachmentsWritten, elapsedMs }` |
| `backup.cancelled` | `{ backupId, canDeletePartial }` |
| `backup.error` | `{ backupId, message }` |

`backupId` is a random string so the renderer can ignore progress from
stale/previous runs.

## Renderer changes

`BackupExport.svelte` gains an internal phase state:

```typescript
type Phase =
  | 'configure'        // existing radio UI
  | 'confirm-overwrite'
  | 'running'
  | 'complete'
  | 'cancel-confirm'
  | 'error'
```

- `configure` — current radio UI; **Export As…** button triggers the folder
  picker then `backup.check_folder`. If non-empty → `confirm-overwrite`;
  otherwise → `running`.
- `confirm-overwrite` — modal-style dialog inside the same page. "Existing
  files in this folder may be overwritten. Continue?" → Yes / Cancel.
- `running` — progress bar + log console + Cancel button. Subscribes to
  `backup.progress` on mount, filters by `backupId`.
- `complete` — summary card + Close button.
- `cancel-confirm` — shown when user clicks Cancel while running. "Delete
  incomplete backup? yes/no". Skipped if the folder was non-empty to start.
- `error` — shows the error message and a Close button.

The console view:

```svelte
<div class="console" bind:this={consoleEl}>
  {#each lines as line}
    <div class="console__line">{line}</div>
  {/each}
</div>
```

CSS: `pointer-events: none; user-select: none; overflow: hidden;`. On each
new line, `consoleEl.scrollTop = consoleEl.scrollHeight`. Keep at most 200
lines in the `$state` array (shift from the front on push).

## Photo Gallery Backup (options 2–5)

**Gallery**, **Screenshots**, **All Images**, and **All Media by Folder** all
use the same daemon pipeline (`src/backup/gallery-export.ts`) via a single
IPC method `backup.media_start` with
`scope: 'gallery' | 'screenshots' | 'images' | 'folders'`.

Flow:
1. Query `gallery.scan` once — returns every media file on external storage
   with path/folder/size/mtime/mimeType/kind.
2. Filter by scope:
   - `gallery` — camera captures only: images + videos whose folder path
     has a `DCIM` segment (case-insensitive). Non-hidden.
   - `screenshots` — only files whose folder path contains a segment named
     "Screenshots" (case-insensitive). Matches `DCIM/Screenshots`,
     `Pictures/Screenshots`, etc.
   - `images` — every image anywhere on the phone (`kind === 'image'`,
     non-hidden).
   - `folders` — every photo and video from every non-hidden folder on the
     phone. **Flattens the phone's folder hierarchy to the leaf folder
     name only**, matching how the app's Folders viewer groups files. So
     `/Movies/Messenger/clip.mp4` becomes `target/Messenger/clip.mp4`, not
     `target/Movies/Messenger/clip.mp4`. Files from different source paths
     that share the same leaf folder name merge into a single target
     folder. The most permissive scope.
3. For each file:
   - Target path: `targetDir + item.path` (preserves phone folder layout, so
     `target/DCIM/Camera/IMG_1234.jpg`).
   - Skip if target exists and its size equals `item.size` — no download,
     no copy. This makes re-exports incremental for free.
   - Else download via `daemon.downloadGalleryFile(path, expectedSize)`,
     copy to target, preserve the phone's mtime on the exported file.
4. Downloaded files stay in the gallery cache (same as thread attachments).

Completion summary carries `kind: 'media'` with `filesWritten`,
`filesSkipped`, `bytesWritten`, `elapsedMs`, `errors`. The renderer's
Complete view renders a media-specific line: *"Wrote 42 file(s) (128.3 MB),
skipped 17 already present, in 94s."*

## Not planned

- Full filesystem/phone-storage dump. Users who need arbitrary non-media
  files should use the **WebDAV mount** feature (Settings → Extras → Phone
  Files) and copy what they want through the file manager.
- Resume after daemon restart (Ctrl-C, crash). If the backup is interrupted
  by something other than the Cancel button, the partial files are left in
  place; next run is a fresh start.
- Re-export incremental ("only new messages since last backup") — not yet.

## Testing plan

Manual, at first:
1. Export with no threads selected in a fresh empty folder → should produce
   0 files with completion summary reporting zero.
2. Export a single small thread with no attachments → inspect the text file
   formatting.
3. Export a thread containing MMS images, with *Include MMS* ticked → inspect
   the `_mms` folder naming and filename-in-text alignment.
4. Export a thread containing MMS images, with *Include MMS* **un**ticked →
   `_mms` folder should not be created, attachment lines should still appear
   in the `.txt` as filenames (pointing nowhere — acceptable or reconsider?).
5. Export into a non-empty folder → overwrite prompt appears.
6. Cancel mid-export from an initially-empty folder → prompt to delete,
   confirm → folder removed.
7. Cancel mid-export from a non-empty folder → no delete prompt, just stop.
8. Export a thread whose attachment bytes are not in the local cache → verify
   attachment appears at target and the cache is NOT left populated afterward
   (check DB `downloaded` flag and file on disk).
9. Export twice into the same directory → second run skips attachments whose
   target file size matches phone-reported size.

## Decision #4 (from chat)

Question raised during planning: "If *Include MMS* is unticked, should the
attachment filename line still appear in the .txt?" I'm defaulting to **yes**
— the line tells the reader that a message had an attachment and what it was
named, even if the file itself isn't bundled. Revisit if this turns out to
look confusing.
