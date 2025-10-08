import { google } from "googleapis";

export function getDriveClient() {
  const b64 = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  if (!b64) throw new Error("Missing GDRIVE_SERVICE_ACCOUNT_JSON env");
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
  ];
  const auth = new google.auth.JWT(
    json.client_email,
    undefined,
    json.private_key,
    scopes
  );
  const drive = google.drive({ version: "v3", auth });
  return drive;
}

export type DriveSaveResult = {
  fileId: string;
  webViewLink?: string;
  name: string;
};

export async function uploadToDrive(params: {
  folderId: string;
  name: string;
  mimeType: string;
  data: Buffer;
}): Promise<DriveSaveResult> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: params.name,
      parents: [params.folderId],
      mimeType: params.mimeType || "text/plain",
    },
    media: {
      mimeType: params.mimeType || "text/plain",
      body: BufferToStream(params.data) as any,
    },
    fields: "id, name, webViewLink",
  } as any);
  return {
    fileId: res.data.id as string,
    name: res.data.name as string,
    webViewLink: res.data.webViewLink as string,
  };
}

export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res: any = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

function BufferToStream(buffer: Buffer) {
  const { Readable } = require("stream");
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}
