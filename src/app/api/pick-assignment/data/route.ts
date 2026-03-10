import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dnId = searchParams.get('dnId') || '';
  const skuId = searchParams.get('skuId') || '';
  try {
    const url = `${APPS_SCRIPT_URL}?action=getPickAssignmentData&dnId=${encodeURIComponent(dnId)}&skuId=${encodeURIComponent(skuId)}`;
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
