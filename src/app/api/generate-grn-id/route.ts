import { NextResponse } from 'next/server';

// Force dynamic so Next.js never caches this - GRN ID must always be fresh
export const dynamic = 'force-dynamic';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  try {
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ grnId: 'GRN-DET-202603-0001' });
    }

    const url = `${APPS_SCRIPT_URL}?action=generateGrnId`;
    const res = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
    });
    const result = await res.json();

    return NextResponse.json({ grnId: result.grnId }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (error: any) {
    console.error('Error generating GRN ID:', error.message);
    return NextResponse.json({ grnId: 'GRN-DET-ERROR' });
  }
}
