import { google } from "googleapis";

export async function getGoogleSheets() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  if (!rawKey || rawKey === "{}" || rawKey === "YOUR_GOOGLE_JSON_KEY_HERE") {
    throw new Error("Missing Google Service Account. Please open the '.env.local' file in your project and paste your Service Account JSON into the GOOGLE_SERVICE_ACCOUNT_KEY variable.");
  }

  let credentials;
  try {
    credentials = JSON.parse(rawKey);
  } catch (err) {
    throw new Error("The GOOGLE_SERVICE_ACCOUNT_KEY in .env.local is not valid JSON. Make sure you pasted the exact content (and wrapped it in single quotes if you are pasting directly into the string).");
  }

  if (!credentials.client_email) {
    throw new Error("Invalid format! You supplied JSON, but it does not contain a 'client_email' field. Please regenerate the JSON Key from Google Cloud IAM.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  return sheets;
}
