import { google } from "googleapis";
import { Readable } from "stream";

export async function getGoogleDrive() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  if (!rawKey || rawKey === "{}" || rawKey === "YOUR_GOOGLE_JSON_KEY_HERE") {
    throw new Error("Missing Google Service Account. Please open the '.env.local' file in your project and paste your Service Account JSON into the GOOGLE_SERVICE_ACCOUNT_KEY variable.");
  }

  let credentials;
  try {
    credentials = JSON.parse(rawKey);
  } catch (err) {
    throw new Error("The GOOGLE_SERVICE_ACCOUNT_KEY in .env.local is not valid JSON. Make sure you pasted the exact content.");
  }

  if (!credentials.client_email) {
    throw new Error("Invalid format! You supplied JSON, but it does not contain a 'client_email' field. Please regenerate the JSON Key from Google Cloud IAM.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const client = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: client as any });
  return drive;
}

export async function uploadToGoogleDrive(fileName: string, mimeType: string, buffer: Buffer) {
  const drive = await getGoogleDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID in .env.local");

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType,
    body: stream,
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: "id, webViewLink",
  });

  return file.data;
}
