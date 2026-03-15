import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1kk5OR00fIrdt8dPJ3GhkkFnjs6tsJ93yEfG9zl2kzYg";

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
    // Parallel fetching for performance
    const [palletRows, pbRows, locRows, forkliftRows] = await Promise.all([
      fetchGViz("Pallet_Status_02", "select A, B, C"),
      fetchGViz("Pallet_Build_IB_04", "select A, C"),
      fetchGViz("Location_Status_01", "select A, B, C, D, E, G"),
      fetchGViz("ForkLift_Master_05", "select A, B")
    ]);

    // Mapping Pallet_ID -> GRN_ID from Pallet_Build_IB_04 (A=GRN_ID, C=Pallet_ID)
    const palletToGrn: Record<string, string> = {};
    pbRows.forEach((r: any) => {
      const g = r?.c?.[0]?.v;
      const p = r?.c?.[1]?.v;
      if (p && g) palletToGrn[String(p).trim()] = String(g).trim();
    });

    // 1. Pending Pallets: Occupancy_Status contains "Occupied", Location_ID is empty
    const pendingPallets = palletRows.map((r: any) => {
      const pid = String(r?.c?.[0]?.v || "").trim();
      const status = String(r?.c?.[1]?.v || "").trim();
      const loc = String(r?.c?.[2]?.v || "").trim();
      return { pid, status, loc };
    }).filter((p: any) => 
      p.status.includes("Occupied") && 
      p.pid && p.pid !== "Pallet_ID" && 
      (!p.loc || p.loc.toLowerCase() === "null" || p.loc === "-" || p.loc === "")
    ).map((p: any) => ({
      Pallet_ID: p.pid,
      GRN_ID: palletToGrn[p.pid] || ""
    }));

    // 2. Free Locations: Occupied contains "Unoccupied" or is empty
    const freeLocations = locRows.map((r: any) => {
      const code = String(r?.c?.[0]?.v || "").trim();
      const aisle = String(r?.c?.[1]?.v || "").trim();
      const bay = String(r?.c?.[2]?.v || "").trim();
      const level = String(r?.c?.[3]?.v || "").trim();
      const depth = String(r?.c?.[4]?.v || "").trim();
      const occupied = String(r?.c?.[5]?.v || "").trim();
      return { code, aisle, bay, level, depth, occupied };
    }).filter((l: any) => 
      l.code && l.code !== "Location_Code" && 
      (l.occupied.toLowerCase().includes("unoccupied") || l.occupied === "" || l.occupied === "null")
    );

    // 3. Forklifts
    const forklifts = forkliftRows.map((r: any) => {
      const id = String(r?.c?.[0]?.v || "").trim();
      const no = String(r?.c?.[1]?.v || "").trim();
      return { id, no, display: `${id} - ${no}` };
    }).filter((f: any) => f.id && f.id !== "ForkLift_ID" && f.id.toLowerCase() !== "null");

    return NextResponse.json({
      pallets: pendingPallets,
      locations: freeLocations,
      forklifts: forklifts
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err: any) {
    console.error("Putaway data fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
