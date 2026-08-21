import { Readable } from "stream";
import { google } from "googleapis";
import { resolvePreEtsDrivePath } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { getGoogleAuth } from "@/lib/google-mail";

export type PreEtsDrivePathVars = {
  schoolYear: string;
  district: string;
  month: string;
  school: string;
  authNumber: string;
};

export function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** Safe segment or file name for Google Drive (no path separators). */
export function sanitizeDriveName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 200) || "unknown";
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  folderName: string
): Promise<string | null> {
  const safeName = sanitizeDriveName(folderName);
  const escaped = escapeDriveQueryValue(safeName);
  const listed = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
  });

  return listed.data.files?.[0]?.id ?? null;
}

async function ensureDriveFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const existing = await findChildFolder(drive, parentFolderId, folderName);
  if (existing) return existing;

  const safeName = sanitizeDriveName(folderName);
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  const folderId = created.data.id;
  if (!folderId) {
    throw new Error(`Could not create Drive folder "${safeName}".`);
  }

  return folderId;
}

/** Walk or create nested folders under a root folder from a resolved path template. */
export async function resolvePreEtsDriveFolderId(
  rootFolderId: string,
  pathTemplate: string,
  vars: PreEtsDrivePathVars
): Promise<string> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const subpath = resolvePreEtsDrivePath(pathTemplate, vars);
  const segments = subpath.split("/").filter(Boolean);

  let folderId = rootFolderId;
  for (const segment of segments) {
    folderId = await ensureDriveFolder(drive, folderId, segment);
  }

  return folderId;
}

export async function uploadPreEtsFileToDrive(options: {
  folderId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; fileName: string; webViewLink: string | null }> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const fileName = sanitizeDriveName(options.fileName);

  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      parents: [options.folderId],
    },
    media: {
      mimeType: options.mimeType,
      body: Readable.from(options.buffer),
    },
    fields: "id",
  });

  const fileId = uploaded.data.id;
  if (!fileId) {
    throw new Error("Drive upload did not return a file id");
  }

  const link = await drive.files.get({
    supportsAllDrives: true,
    fileId,
    fields: "webViewLink",
  });

  return {
    fileId,
    fileName,
    webViewLink: link.data.webViewLink ?? driveFileViewUrl(fileId),
  };
}

export async function uploadPreEtsFileToDrivePath(options: {
  rootFolderId: string;
  pathTemplate: string;
  pathVars: PreEtsDrivePathVars;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; fileName: string; webViewLink: string | null; folderId: string }> {
  const folderId = await resolvePreEtsDriveFolderId(
    options.rootFolderId,
    options.pathTemplate,
    options.pathVars
  );

  const uploaded = await uploadPreEtsFileToDrive({
    folderId,
    fileName: options.fileName,
    mimeType: options.mimeType,
    buffer: options.buffer,
  });

  return { ...uploaded, folderId };
}
