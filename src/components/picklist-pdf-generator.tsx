"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PicklistRow {
  Pick_ID: string;
  Pallet_ID: string;
  GRN_ID: string;
  SKU_ID: string;
  SKU_Description: string;
  Expiry_Date: string;
  Batch_Number: string;
  Location_ID: string;
  Free_Good_Box_Qty: number;
  Free_Damage_Box_Qty: number;
  Free_Total_Qty: number;
  Pick_Good_Box_Qty: number;
  Pick_Damage_Box_Qty: number;
  Pick_Total_Qty: number;
  Closing_of_SKU: number;
  Closing_of_Palet: number;
  Status: string;
  Is_Last_Pallet: string;
}

interface PicklistPdfProps {
  // DNs already known from parent (eligibleDns), filter to Picklist Generated
  completedDNs: { DN_ID: string; Customer_Name: string }[];
}

export function PicklistPdfGenerator({ completedDNs }: PicklistPdfProps) {
  const [selectedDN, setSelectedDN] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePrint = async () => {
    if (!selectedDN) return setError("Please select a DN.");
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/pick-assignment/picklist?dnId=${encodeURIComponent(selectedDN)}`);
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Failed to fetch picklist");
      openPrintWindow(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error generating picklist");
    } finally {
      setLoading(false);
    }
  };

  const openPrintWindow = (data: {
    dnId: string;
    customerName: string;
    orderDate: string;
    dnStatus: string;
    rows: PicklistRow[];
  }) => {
    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = new Date().toLocaleTimeString("en-IN");

    // Group rows by SKU for sub-totals
    const rowsHtml = data.rows.map((r, idx) => `
      <tr class="${idx % 2 === 0 ? "even" : "odd"}">
        <td>${r.Pick_ID || "—"}</td>
        <td>${r.Pallet_ID || "—"}</td>
        <td>${r.GRN_ID || "—"}</td>
        <td>${r.SKU_ID || "—"}</td>
        <td>${r.SKU_Description || "—"}</td>
        <td>${r.Batch_Number || "—"}</td>
        <td>${r.Expiry_Date || "—"}</td>
        <td>${r.Location_ID || "—"}</td>
        <td class="num">${r.Free_Good_Box_Qty}</td>
        <td class="num dmg">${r.Free_Damage_Box_Qty}</td>
        <td class="num bold">${r.Free_Total_Qty}</td>
        <td class="num pick">${r.Pick_Good_Box_Qty}</td>
        <td class="num dmg">${r.Pick_Damage_Box_Qty}</td>
        <td class="num bold pick">${r.Pick_Total_Qty}</td>
        <td class="num">${r.Closing_of_Palet}</td>
        <td class="num">${r.Closing_of_SKU}</td>
        <td class="${r.Is_Last_Pallet === "Yes" ? "last-yes" : ""}">${r.Is_Last_Pallet}</td>
      </tr>
    `).join("");

    const totalPickGood = data.rows.reduce((s, r) => s + r.Pick_Good_Box_Qty, 0);
    const totalPickDmg  = data.rows.reduce((s, r) => s + r.Pick_Damage_Box_Qty, 0);
    const totalPickQty  = data.rows.reduce((s, r) => s + r.Pick_Total_Qty, 0);
    const totalFreeQty  = data.rows.reduce((s, r) => s + r.Free_Total_Qty, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Picklist – ${data.dnId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; background: #fff; padding: 16px; }

  .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #000; padding-bottom: 10px; }
  .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .header .meta { font-size: 10px; color: #444; display: flex; justify-content: space-between; margin-top: 6px; }
  .header .badge { display: inline-block; background: #e8f5e9; border: 1px solid #4caf50; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }

  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1e293b; color: #fff; padding: 6px 4px; text-align: center; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #334155; }
  td { border: 1px solid #cbd5e1; padding: 5px 4px; vertical-align: middle; text-align: left; }
  tr.even td { background: #f8fafc; }
  tr.odd td { background: #fff; }
  td.num { text-align: right; font-family: monospace; }
  td.bold { font-weight: bold; }
  td.pick { color: #166534; }
  td.dmg  { color: #92400e; }
  td.last-yes { font-weight: bold; color: #b45309; text-align: center; }

  tfoot tr td { background: #1e293b; color: #fff; font-weight: bold; padding: 6px 4px; text-align: right; font-family: monospace; border: 1px solid #334155; }
  tfoot tr td:first-child { text-align: left; }

  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
  .sig-block { margin-top: 30px; display: flex; justify-content: space-between; }
  .sig-block div { text-align: center; width: 30%; }
  .sig-block .sig-line { border-top: 1px solid #000; margin-top: 30px; padding-top: 4px; font-size: 9px; }

  @media print {
    body { padding: 8px; }
    @page { size: A4 landscape; margin: 10mm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="no-print" style="margin-bottom:12px;text-align:right;">
  <button onclick="window.print()" style="padding:8px 20px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;">🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#6b7280;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;margin-left:8px;">✕ Close</button>
</div>

<div class="header">
  <h1>Picklist – ${data.dnId}</h1>
  <div class="meta">
    <span>Customer: <strong>${data.customerName || "—"}</strong></span>
    <span>Order Date: <strong>${data.orderDate || "—"}</strong></span>
    <span>Status: <span class="badge">${data.dnStatus || "—"}</span></span>
    <span>Generated: <strong>${now} ${timeStr}</strong></span>
    <span>Total Rows: <strong>${data.rows.length}</strong></span>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Pick ID</th>
      <th>Pallet</th>
      <th>GRN</th>
      <th>SKU</th>
      <th>Description</th>
      <th>Batch</th>
      <th>Expiry</th>
      <th>Location</th>
      <th>Free Good</th>
      <th>Free Dmg</th>
      <th>Free Total</th>
      <th>Pick Good</th>
      <th>Pick Dmg</th>
      <th>Pick Total</th>
      <th>Closing Pallet</th>
      <th>Closing SKU</th>
      <th>Last?</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot>
    <tr>
      <td colspan="10">TOTALS (${data.rows.length} lines)</td>
      <td>${totalFreeQty}</td>
      <td>${totalPickGood}</td>
      <td>${totalPickDmg}</td>
      <td>${totalPickQty}</td>
      <td>—</td><td>—</td><td>—</td>
    </tr>
  </tfoot>
</table>

<div class="sig-block">
  <div><div class="sig-line">Picker Signature</div></div>
  <div><div class="sig-line">Supervisor Signature</div></div>
  <div><div class="sig-line">Warehouse Manager</div></div>
</div>

<div class="footer">
  <span>Document: Picklist / ${data.dnId}</span>
  <span>Generated by WMS on ${now} at ${timeStr}</span>
  <span>Page 1</span>
</div>

</body>
</html>`;

    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) return setError("Popup blocked. Please allow popups and try again.");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  return (
    <Card className="shadow-sm border-dashed border-2 border-primary/30">
      <CardHeader className="border-b py-3 px-5 bg-primary/5">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
          📄 Picklist PDF Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        {error && <div className="mb-3 p-3 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{error}</div>}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-48">
            <label className="text-sm font-semibold text-muted-foreground">Select DN (Picklist Generated):</label>
            <select
              value={selectedDN}
              onChange={e => { setSelectedDN(e.target.value); setError(""); }}
              className="w-full h-10 px-3 border border-input rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            >
              <option value="">-- Select DN --</option>
              {completedDNs.map(d => (
                <option key={d.DN_ID} value={d.DN_ID}>{d.DN_ID} — {d.Customer_Name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedDN || loading}
            className="h-10 px-6 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <><span className="animate-spin">⏳</span> Loading...</>
            ) : (
              <><span>🖨</span> Print Picklist PDF</>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Only DNs with status <strong>&quot;Picklist Generated&quot;</strong> appear here. Opens a print-ready page (landscape A4).
        </p>
      </CardContent>
    </Card>
  );
}
