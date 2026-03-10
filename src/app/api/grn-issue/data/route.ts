import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "14iW26B06PFTKr3nmdYT_3RmjqjGRww7J8atnU0rYiHA";

async function fetchGViz(sheetName: string, query: string = "select *") {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}&tq=${encodeURIComponent(query)}`;
  const res = await fetch(gvizUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const text = await res.text();
  const jsonStr = text.replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '').replace(/\);\s*$/, '');
  try {
    const json = JSON.parse(jsonStr);
    return json?.table?.rows || [];
  } catch(e) {
    return [];
  }
}

export async function GET() {
  try {
    const [grnRows, detailRows, pbRows] = await Promise.all([
      fetchGViz("GRN_Entry_IB_01", "select A, N"), // A=GRN_ID, N=Status
      fetchGViz("GRN_Detail_IB_02", "select A, E"), // A=GRN_ID, E=Invoice_Quantity
      fetchGViz("Pallet_Build_IB_04", "select A, O") // A=GRN_ID, O=Total_Received_Qty_Boxes
    ]);

    // Aggregate Invoice Quantity by GRN
    const invoiceQtyMap: Record<string, number> = {};
    detailRows.forEach((r: any) => {
      const grnId = String(r?.c?.[0]?.v || "").trim();
      const qty = parseFloat(r?.c?.[1]?.v || 0) || 0;
      if (grnId && grnId !== "GRN_ID") {
        invoiceQtyMap[grnId] = (invoiceQtyMap[grnId] || 0) + qty;
      }
    });

    // Aggregate Actual Quantity by GRN
    const actualQtyMap: Record<string, number> = {};
    pbRows.forEach((r: any) => {
      const grnId = String(r?.c?.[0]?.v || "").trim();
      const qty = parseFloat(r?.c?.[1]?.v || 0) || 0;
      if (grnId && grnId !== "GRN_ID") {
        actualQtyMap[grnId] = (actualQtyMap[grnId] || 0) + qty;
      }
    });

    // Filter GRNs by Status
    const readyGrns = grnRows.map((r: any) => {
      const grnId = String(r?.c?.[0]?.v || "").trim();
      const status = String(r?.c?.[1]?.v || "").trim();
      return { grnId, status };
    }).filter((g: any) => 
      g.grnId && g.grnId !== "GRN_ID" && 
      (g.status === "Unloading Completed" || g.status === "Putaway Completed")
    ).map((g: any) => ({
      GRN_ID: g.grnId,
      Status: g.status,
      Invoice_Quantity: invoiceQtyMap[g.grnId] || 0,
      Actual_Quantity: actualQtyMap[g.grnId] || 0,
    }));

    return NextResponse.json({
      status: "success",
      grns: readyGrns
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err: any) {
    console.error("GRN Issue data fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
