import { NextResponse } from 'next/server';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submitDnEntry', ...body }),
      redirect: 'follow',
    });
    const resultText = await res.text();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (_) {
      result = res.ok ? { status: 'success' } : { status: 'error', message: resultText.substring(0, 100) };
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
