import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "14iW26B06PFTKr3nmdYT_3RmjqjGRww7J8atnU0rYiHA";
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  // Try GViz first — reads Dock_ID (column A) from Dock_Master_06
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Dock_Master_06&tq=select%20A%20where%20A%20is%20not%20null`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    const text = await res.text();
    const jsonStr = text
      .replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
      .replace(/\);\s*$/, '');
    const json = JSON.parse(jsonStr);
    const rows = json?.table?.rows || [];
    const docks = rows
      .map((row: any) => String(row?.c?.[0]?.v || "").trim())
      .filter((d: string) => d !== "" && d.toLowerCase() !== "dock_id");

    if (docks.length > 0) {
      return NextResponse.json({ docks }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (err) {
    console.log('GViz dock fetch failed, trying Apps Script...');
  }

  // Fallback: Apps Script
  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=getDocks`, { cache: 'no-store', redirect: 'follow' });
      const result = await res.json();
      return NextResponse.json({ docks: result.docks || [] });
    } catch {}
  }

  return NextResponse.json({ docks: [] });
}
