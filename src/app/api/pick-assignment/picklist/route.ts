import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET(req: NextRequest) {
  try {
    const dnId = req.nextUrl.searchParams.get("dnId") || "";
    if (!dnId) return NextResponse.json({ status: "error", message: "dnId is required" }, { status: 400 });
    const url = `${APPS_SCRIPT_URL}?action=getPicklistData&dnId=${encodeURIComponent(dnId)}`;
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: 'error', message: msg }, { status: 500 });
  }
}
