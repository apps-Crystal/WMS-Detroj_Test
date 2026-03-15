import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1kk5OR00fIrdt8dPJ3GhkkFnjs6tsJ93yEfG9zl2kzYg";
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export async function GET() {
  // Try GViz first — reads columns B (SKU_ID) and C (SKU_Description) directly
  // Works because sheet is shared as "Anyone with the link"
  try {
    // Select col B and C where col B is not null
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=SKU_Master_02&tq=select%20B%2CC%20where%20B%20is%20not%20null`;
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    const text = await res.text();

    const jsonStr = text
      .replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
      .replace(/\);\s*$/, '');
    const json = JSON.parse(jsonStr);

    const rows = json?.table?.rows || [];
    const skus = rows
      .map((row: any) => ({
        sku_id: row?.c?.[0]?.v || "",
        description: row?.c?.[1]?.v || "",
      }))
      .filter((s: any) => s.sku_id && s.sku_id.trim() !== "");

    if (skus.length > 0) {
      return NextResponse.json({ skus }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (err) {
    console.log('GViz SKU fetch failed, trying Apps Script...');
  }

  // Fallback: Apps Script
  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=getSKUs`, { cache: 'no-store', redirect: 'follow' });
      const result = await res.json();
      return NextResponse.json({ skus: result.skus || [] });
    } catch (err) {
      console.error('Apps Script SKU fetch failed:', err);
    }
  }

  return NextResponse.json({ skus: [] });
}
