import { mkdir, writeFile, readFile, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

// Blob storage for chat images (uploads + generated). Rows live in Postgres,
// bytes live on disk under DATA_DIR so the database stays small. In Docker,
// mount a volume at DATA_DIR (see docker-compose.yml).
const DATA_DIR = process.env.DATA_DIR || "./.data";
const DIR = path.join(DATA_DIR, "attachments");

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const attachmentExt = (mime) => MIME_EXT[mime] || "bin";

const fileFor = (id, mime) => path.join(DIR, `${id}.${attachmentExt(mime)}`);

// id is always a server-generated uuid; still refuse anything with a separator.
const safeId = (id) => (/^[a-f0-9-]{36}$/i.test(String(id)) ? id : null);

// Persist one image: write the file, then create the row. Returns the row.
export async function saveAttachment({
  accountId,
  chatId = null,
  messageId = null,
  kind,
  mime,
  buffer,
  width = null,
  height = null,
}) {
  await mkdir(DIR, { recursive: true });
  const row = await prisma.attachment.create({
    data: {
      accountId,
      chatId,
      messageId,
      kind,
      mime,
      width,
      height,
      bytes: buffer.length,
    },
  });
  await writeFile(fileFor(row.id, mime), buffer);
  return row;
}

// Read one image by id. No auth here: the attachment route gates on a signed
// token, and the id is an unguessable uuid.
export async function readAttachment(id) {
  const clean = safeId(id);
  if (!clean) return null;
  const row = await prisma.attachment.findUnique({ where: { id: clean } });
  if (!row) return null;
  try {
    return { mime: row.mime, body: await readFile(fileFor(row.id, row.mime)) };
  } catch {
    return null;
  }
}

const unlinkRows = async (rows) => {
  for (const r of rows) {
    await unlink(fileFor(r.id, r.mime)).catch(() => {});
  }
};

// Remove the files behind a set of chats (call before the rows cascade away).
export async function deleteAttachmentFilesForChats(chatIds) {
  if (!chatIds.length) return;
  const rows = await prisma.attachment.findMany({
    where: { chatId: { in: chatIds } },
    select: { id: true, mime: true },
  });
  await unlinkRows(rows);
}

export async function deleteAttachmentFilesForAccount(accountId) {
  const rows = await prisma.attachment.findMany({
    where: { accountId },
    select: { id: true, mime: true },
  });
  await unlinkRows(rows);
}

// Backstop: drop files on disk that have no row (a crash between write and
// row-create, or a delete path that missed). Safe to run on a schedule.
export async function sweepAttachments() {
  let files;
  try {
    files = await readdir(DIR);
  } catch {
    return 0; // dir not created yet
  }
  if (!files.length) return 0;

  const ids = files.map((f) => f.replace(/\.[^.]+$/, ""));
  const rows = await prisma.attachment.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const known = new Set(rows.map((r) => r.id));

  let removed = 0;
  for (const f of files) {
    if (known.has(f.replace(/\.[^.]+$/, ""))) continue;
    try {
      await unlink(path.join(DIR, f));
      removed += 1;
    } catch (e) {
      logError("attachment_sweep_unlink_failed", e, { file: f });
    }
  }
  return removed;
}
