import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured' }, { status: 500 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Send to Apps Script which will save to Google Drive
    // Caller can pass a custom folderId via form data; falls back to env var
    const customFolderId = formData.get('folderId') as string | null;
    const payload = {
      action: "uploadFile",
      fileName: file.name,
      mimeType: file.type,
      base64Data: base64,
      folderId: customFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "1YkfrxizeZWGDXakb5-MVfSKEdIK5Y6TO"
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const result = await res.json();

    if (result.status === "error") {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    return NextResponse.json({ url: result.url, id: result.id });
  } catch (error: any) {
    console.error('File upload error:', error.message);
    return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}

