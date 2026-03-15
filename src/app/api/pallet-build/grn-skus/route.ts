import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1kk5OR00fIrdt8dPJ3GhkkFnjs6tsJ93yEfG9zl2kzYg";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grnId = searchParams.get('grnId');

  if (!grnId) {
    return NextResponse.json({ skus: [], error: 'GRN ID is required' }, { status: 400 });
  }

  try {
    // Escaping the grnId to prevent injection issues in Gviz
    const escapedGrnId = grnId.replace(/'/g, "''");
    
    // Columns in GRN_Detail_IB_02: A(GRN_ID), B(Line_No), C(SKU_ID), D(SKU_Description)
    // We only want rows where GRN_ID = escapedGrnId
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=GRN_Detail_IB_02&tq=select%20C%2C%20D%20where%20A%20%3D%20'${escapedGrnId}'`;
    
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    const text = await res.text();
    const jsonStr = text
      .replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
      .replace(/\);\s*$/, '');
      
    const json = JSON.parse(jsonStr);
    const rows = json?.table?.rows || [];
    
    const skus = rows
      .map((row: any) => ({
        sku_id: String(row?.c?.[0]?.v || "").trim(),
        description: String(row?.c?.[1]?.v || "").trim(),
      }))
      .filter((s: any) => s.sku_id && s.sku_id.toLowerCase() !== "sku_id"); // Filter out empty or headers

    return NextResponse.json({ skus }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('GViz SKU fetch failed:', err);
    return NextResponse.json({ skus: [], error: err.message }, { status: 500 });
  }
}
