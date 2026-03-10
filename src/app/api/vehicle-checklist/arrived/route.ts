import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getArrivedGRNs`, { cache: 'no-store', redirect: 'follow' });
    const result = await res.json();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', grns: [], message: err.message });
  }
}
