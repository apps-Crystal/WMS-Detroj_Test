import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=generatePickId`, { cache: 'no-store', redirect: 'follow' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
