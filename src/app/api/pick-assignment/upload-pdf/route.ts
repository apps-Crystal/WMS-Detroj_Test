import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

// POST — first fetches picklist data then uploads PDF to Drive
export async function POST(req: NextRequest) {
  try {
    const { dnId } = await req.json();
    if (!dnId) return NextResponse.json({ status: "error", message: "dnId required" }, { status: 400 });

    // 1. Fetch the picklist rows + header info
    const dataRes = await fetch(
      `${APPS_SCRIPT_URL}?action=getPicklistData&dnId=${encodeURIComponent(dnId)}`,
      { cache: "no-store", redirect: "follow" }
    );
    const pickData = await dataRes.json();
    if (pickData.status !== "success") {
      return NextResponse.json({ status: "error", message: pickData.message || "Failed to fetch picklist data" });
    }

    // 2. Call Apps Script to generate PDF → save to Drive → return URL
    const pdfRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      body: JSON.stringify({
        action: "generatePicklistPDF",
        dnId: pickData.dnId,
        customerName: pickData.customerName,
        orderDate: pickData.orderDate,
        rows: pickData.rows,
      }),
    });
    const pdfData = await pdfRes.json();
    return NextResponse.json(pdfData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", message: msg }, { status: 500 });
  }
}
