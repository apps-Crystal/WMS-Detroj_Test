import { NextResponse } from 'next/server';

// Uses Google Apps Script Web App - no service account needed
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ error: 'APPS_SCRIPT_URL not configured in .env.local' }, { status: 500 });
    }

    const payload = {
      action: "signup",
      name: data.name,
      email: data.email,
      password: data.password,
      access: "PENDING"
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const result = await res.json();

    if (result.status === "error") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Signup error:', error.message);
    return NextResponse.json({ error: 'Signup failed: ' + error.message }, { status: 500 });
  }
}
