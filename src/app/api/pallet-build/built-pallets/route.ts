import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1kk5OR00fIrdt8dPJ3GhkkFnjs6tsJ93yEfG9zl2kzYg";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grnId = searchParams.get('grnId');

  if (!grnId) {
    return NextResponse.json({ pallets: [], error: 'GRN ID is required' }, { status: 400 });
  }

  try {
    const escapedGrnId = grnId.replace(/'/g, "''");
    // Columns in Pallet_Build_IB_04:
    // A: GRN_ID
    // C: Pallet_ID
    // H: SKU_ID
    // I: SKU_Description
    // J: Batch_Number
    // K: Manufacturing_Date
    // L: Expiry_Date
    // M: Good_Box_Qty
    // N: Damage_Box_Qty
    // O: Total_Received_Qty_Boxes
    
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Pallet_Build_IB_04&tq=select%20A%2CC%2CH%2CI%2CJ%2CK%2CL%2CM%2CN%2CO%20where%20A%20%3D%20'${escapedGrnId}'`;
    
    const res = await fetch(gvizUrl, { cache: 'no-store' });
    const text = await res.text();
    const jsonStr = text
      .replace(/^\/\*[^*]*\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
      .replace(/\);\s*$/, '');
      
    const json = JSON.parse(jsonStr);
    const rows = json?.table?.rows || [];
    
    const pallets = rows.map((row: any) => ({
      GRN_ID: String(row?.c?.[0]?.v || "").trim(),
      Pallet_ID: String(row?.c?.[1]?.v || "").trim(),
      SKU_ID: String(row?.c?.[2]?.v || "").trim(),
      SKU_Description: String(row?.c?.[3]?.v || "").trim(),
      Batch_Number: String(row?.c?.[4]?.v || "").trim(),
      Manufacturing_Date: row?.c?.[5]?.v ? String(row.c[5].v) : "",
      Expiry_Date: row?.c?.[6]?.v ? String(row.c[6].v) : "",
      Good_Box_Qty: String(row?.c?.[7]?.v || "0").trim(),
      Damage_Box_Qty: String(row?.c?.[8]?.v || "0").trim(),
      Total_Received_Qty_Boxes: String(row?.c?.[9]?.v || "0").trim(),
    }));

    // Filter out header row if accidentally caught
    const filtered = pallets.filter((p: any) => p.Pallet_ID && p.Pallet_ID.toLowerCase() !== "pallet_id");

    return NextResponse.json({ pallets: filtered }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('GViz built pallets fetch failed:', err);
    return NextResponse.json({ pallets: [], error: err.message }, { status: 500 });
  }
}
