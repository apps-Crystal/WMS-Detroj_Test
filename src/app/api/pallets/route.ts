import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1kk5OR00fIrdt8dPJ3GhkkFnjs6tsJ93yEfG9zl2kzYg";
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  // Try GViz first — reads Pallet_ID (column A) and Occupancy_Status (column B) from Pallet_Status_02
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Pallet_Status_02&tq=select%20A%2C%20B%20where%20A%20is%20not%20null`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    const text = await res.text();
    const jsonStr = text
      .replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
      .replace(/\);\s*$/, '');
    const json = JSON.parse(jsonStr);
    const rows = json?.table?.rows || [];
    
    // Filter out pallets that are already occupied
    const pallets = rows
      .map((row: any) => ({
        id: String(row?.c?.[0]?.v || "").trim(),
        status: String(row?.c?.[1]?.v || "").trim(),
      }))
      .filter((p: any) => p.id !== "" && p.id.toLowerCase() !== "pallet_id" && p.status !== "✅ Occupied")
      .map((p: any) => p.id);

    return NextResponse.json({ pallets }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.log('GViz pallet fetch failed:', err);
  }

  return NextResponse.json({ pallets: [] });
}
