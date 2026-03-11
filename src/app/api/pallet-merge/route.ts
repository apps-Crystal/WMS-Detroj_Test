import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

// GET ?palletId=P0837 — fetch inventory rows for preview
export async function GET(req: NextRequest) {
  try {
    const palletId = req.nextUrl.searchParams.get("palletId") || "";
    if (!palletId) return NextResponse.json({ status: "error", message: "palletId required" }, { status: 400 });
    const res = await fetch(
      `${APPS_SCRIPT_URL}?action=getPalletDetails&palletId=${encodeURIComponent(palletId)}`,
      { cache: "no-store", redirect: "follow" }
    );
    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST { sourcePalletId, destinationPalletId } — execute merge
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify({ action: "mergePallets", ...body }),
    });
    return NextResponse.json(await res.json());
  } catch (err: unknown) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
