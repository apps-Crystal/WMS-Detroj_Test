import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "14iW26B06PFTKr3nmdYT_3RmjqjGRww7J8atnU0rYiHA";

// Force dynamic so Next.js never caches this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use Google Sheets GViz API - reads column B (Customer_Name) directly
    // Works because sheet is shared as "Anyone with the link"
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Customer_Master_01&tq=select%20B%20where%20B%20is%20not%20null`;

    const res = await fetch(gvizUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    const text = await res.text();

    // GViz returns: /*O_o*/google.visualization.Query.setResponse({...});
    // Strip the JSONP wrapper to get pure JSON
    const jsonStr = text.replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '').replace(/\);\s*$/, '');
    const json = JSON.parse(jsonStr);

    const rows = json?.table?.rows || [];
    const customers: string[] = rows
      .map((row: any) => row?.c?.[0]?.v)
      .filter((v: any) => v && typeof v === 'string' && v.trim() !== '');

    return NextResponse.json({ customers }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (err: any) {
    console.error('Customer fetch error:', err.message);
    return NextResponse.json({ customers: [], error: err.message });
  }
}
