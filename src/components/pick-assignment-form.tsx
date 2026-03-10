"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ── Types ─────────────────────────────────────────────────── */
interface DN { DN_ID: string; Customer_Name: string; Status: string; }
interface DNSKU { SKU_ID: string; SKU_Description: string; Order_Quantity: number; Line_No: string; }
interface Pallet {
  Pallet_ID: string; GRN_ID: string; SKU_ID: string; SKU_Description: string;
  Batch_Number: string; Expiry_Date: string; Location_ID: string;
  Free_Good_Box_Qty: number; Free_Damage_Box_Qty: number; Free_Total_Qty: number;
}
interface PickRow extends Pallet {
  Pick_Good_Box_Qty: number;
  Pick_Damage_Box_Qty: number;
  Is_Last: boolean;
}

/* ── Component ─────────────────────────────────────────────── */
export function PickAssignmentForm() {
  const { data: session } = useSession();
  void session;

  // Master data
  const [dns, setDns] = useState<DN[]>([]);
  const [dnSkus, setDnSkus] = useState<DNSKU[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);

  // Selections
  const [selectedDN, setSelectedDN] = useState("");
  const [selectedSKU, setSelectedSKU] = useState("");
  const [selectedSKUObj, setSelectedSKUObj] = useState<DNSKU | null>(null);

  // Row state: palletId -> pick quantities
  const [pickRows, setPickRows] = useState<Record<string, PickRow>>({});

  // auto-assign pick ID base
  const [pickIdBase, setPickIdBase] = useState("PICK-0001");

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Initial load: fetch DNs + pick ID
  useEffect(() => {
    fetch("/api/pick-assignment/data").then(r => r.json()).then(d => {
      if (d.eligibleDns) setDns(d.eligibleDns);
    });
    fetch("/api/pick-assignment/generate-id").then(r => r.json()).then(d => {
      if (d.nextId) setPickIdBase(d.nextId);
    });
  }, []);

  // ── When DN changes: load its SKUs
  useEffect(() => {
    setSelectedSKU(""); setSelectedSKUObj(null); setPallets([]); setPickRows({});
    setDnSkus([]);
    if (!selectedDN) return;
    setLoading(true);
    fetch(`/api/pick-assignment/data?dnId=${encodeURIComponent(selectedDN)}`).then(r => r.json()).then(d => {
      setDnSkus(d.dnSkus || []);
    }).finally(() => setLoading(false));
  }, [selectedDN]);

  // ── When SKU changes: load pallets
  const loadPallets = useCallback(async (skuId: string) => {
    if (!skuId || !selectedDN) return;
    setLoading(true); setPallets([]); setPickRows({});
    try {
      const d = await fetch(`/api/pick-assignment/data?dnId=${encodeURIComponent(selectedDN)}&skuId=${encodeURIComponent(skuId)}`).then(r => r.json());
      const ps: Pallet[] = d.pallets || [];
      setPallets(ps);
      // Initialise pick rows with 0 pick quantities
      const rows: Record<string, PickRow> = {};
      ps.forEach(p => { rows[p.Pallet_ID] = { ...p, Pick_Good_Box_Qty: 0, Pick_Damage_Box_Qty: 0, Is_Last: false }; });
      setPickRows(rows);
    } finally { setLoading(false); }
  }, [selectedDN]);

  const handleSKUChange = (skuId: string) => {
    setSelectedSKU(skuId);
    const sku = dnSkus.find(s => s.SKU_ID === skuId) || null;
    setSelectedSKUObj(sku);
    loadPallets(skuId);
  };

  // ── Derived values
  const totalPickedGood = Object.values(pickRows).reduce((s, r) => s + (r.Pick_Good_Box_Qty || 0), 0);
  const totalPickedDamage = Object.values(pickRows).reduce((s, r) => s + (r.Pick_Damage_Box_Qty || 0), 0);
  const totalPicked = totalPickedGood + totalPickedDamage;
  const orderQty = selectedSKUObj?.Order_Quantity || 0;
  const closingOfSKU = Math.max(0, orderQty - totalPicked);

  const getClosingOfPallet = (p: PickRow) =>
    Math.max(0, p.Free_Total_Qty - (p.Pick_Good_Box_Qty || 0) - (p.Pick_Damage_Box_Qty || 0));

  // ── Default Assign (FEFO: pallets already sorted by expiry from backend)
  const handleDefaultAssign = () => {
    let remaining = orderQty;
    const newRows = { ...pickRows };
    pallets.forEach((p, idx) => {
      if (remaining <= 0) { newRows[p.Pallet_ID] = { ...newRows[p.Pallet_ID], Pick_Good_Box_Qty: 0, Pick_Damage_Box_Qty: 0, Is_Last: false }; return; }
      const assignGood = Math.min(p.Free_Good_Box_Qty, remaining);
      remaining -= assignGood;
      const assignDamage = Math.min(p.Free_Damage_Box_Qty, remaining);
      remaining -= assignDamage;
      newRows[p.Pallet_ID] = { ...newRows[p.Pallet_ID], Pick_Good_Box_Qty: assignGood, Pick_Damage_Box_Qty: assignDamage, Is_Last: false };
      void idx;
    });
    // Mark last pallet that has any pick
    const pickingPallets = pallets.filter(p => (newRows[p.Pallet_ID].Pick_Good_Box_Qty + newRows[p.Pallet_ID].Pick_Damage_Box_Qty) > 0);
    if (pickingPallets.length > 0) {
      const lastPid = pickingPallets[pickingPallets.length - 1].Pallet_ID;
      newRows[lastPid] = { ...newRows[lastPid], Is_Last: true };
    }
    setPickRows(newRows);
  };

  const updateRow = (palletId: string, field: "Pick_Good_Box_Qty" | "Pick_Damage_Box_Qty", value: number) => {
    setPickRows(prev => {
      const updated = { ...prev, [palletId]: { ...prev[palletId], [field]: Math.max(0, value) } };
      // Auto-mark last picking pallet
      const active = pallets.filter(p => (updated[p.Pallet_ID].Pick_Good_Box_Qty + updated[p.Pallet_ID].Pick_Damage_Box_Qty) > 0);
      pallets.forEach(p => { updated[p.Pallet_ID] = { ...updated[p.Pallet_ID], Is_Last: false }; });
      if (active.length > 0) updated[active[active.length - 1].Pallet_ID] = { ...updated[active[active.length - 1].Pallet_ID], Is_Last: true };
      return updated;
    });
  };

  // ── Check if all SKUs in DN have been assigned
  const assignedSkuIds = new Set<string>();
  const [completedSKUs, setCompletedSKUs] = useState<Set<string>>(new Set());
  void assignedSkuIds;

  // ── Submit
  const handleSubmit = async () => {
    const activeRows = pallets.filter(p => {
      const r = pickRows[p.Pallet_ID];
      return r && (r.Pick_Good_Box_Qty > 0 || r.Pick_Damage_Box_Qty > 0);
    });
    if (activeRows.length === 0) return setErrorMsg("No pick quantities entered. Please enter quantities or use Default Assign.");

    setIsSubmitting(true); setSuccessMsg(""); setErrorMsg("");
    try {
      // Generate unique Pick IDs per row
      const baseNum = parseInt(pickIdBase.replace("PICK-", ""), 10) || 1;
      const newlyCompletedSKUs = new Set(completedSKUs);
      newlyCompletedSKUs.add(selectedSKU);

      // All SKU IDs in this DN
      const allSkusDone = dnSkus.every(s => newlyCompletedSKUs.has(s.SKU_ID));

      const rows = activeRows.map((p, idx) => {
        const r = pickRows[p.Pallet_ID];
        const pickTotal = (r.Pick_Good_Box_Qty || 0) + (r.Pick_Damage_Box_Qty || 0);
        return {
          DN_ID: selectedDN,
          Pick_ID: "PICK-" + String(baseNum + idx).padStart(4, "0"),
          Pallet_ID: p.Pallet_ID,
          GRN_ID: p.GRN_ID,
          SKU_ID: p.SKU_ID,
          SKU_Description: p.SKU_Description,
          Expiry_Date: p.Expiry_Date,
          Batch_Number: p.Batch_Number,
          Location_ID: p.Location_ID,
          Free_Good_Box_Qty: p.Free_Good_Box_Qty,
          Free_Damage_Box_Qty: p.Free_Damage_Box_Qty,
          Free_Total_Qty: p.Free_Total_Qty,
          Pick_Good_Box_Qty: r.Pick_Good_Box_Qty || 0,
          Pick_Damage_Box_Qty: r.Pick_Damage_Box_Qty || 0,
          Pick_Total_Qty: pickTotal,
          Closing_of_SKU: closingOfSKU,
          Closing_of_Palet: getClosingOfPallet(r),
          Is_This_Last_Pallet_For_Pick_Assignment: r.Is_Last ? "Yes" : "No",
        };
      });

      const res = await fetch("/api/pick-assignment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ DN_ID: selectedDN, rows, allSkusDone }),
      });
      const d = await res.json();
      if (d.status !== "success") throw new Error(d.message || "Submission failed");

      setCompletedSKUs(newlyCompletedSKUs);
      setSuccessMsg(`✅ Pick Assignment saved! ${rows.length} pallets assigned for ${selectedSKU}${allSkusDone ? " — DN Status updated to Picklist Generated!" : ""}`);

      // Reset SKU selection to pick next one
      setSelectedSKU(""); setSelectedSKUObj(null); setPallets([]); setPickRows({});
      // Refresh pick ID
      fetch("/api/pick-assignment/generate-id").then(r => r.json()).then(d => d.nextId && setPickIdBase(d.nextId));

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render
  const statusColor = (s: string) => s === "Picklist Generated" ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200";

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">02 Pick Assignment — OB</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Assign inventory pallets to Delivery Note pick lines. Sorted FEFO.</p>
            </div>
            <span className="font-mono text-sm font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">Next: {pickIdBase}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
          {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

          {/* DN + SKU selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700">Select DN ID <span className="text-red-500">*</span></label>
              <select
                value={selectedDN}
                onChange={e => { setSelectedDN(e.target.value); setCompletedSKUs(new Set()); setSuccessMsg(""); setErrorMsg(""); }}
                className="w-full h-10 px-3 border border-input rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono">
                <option value="">-- Select DN --</option>
                {dns.map(d => (
                  <option key={d.DN_ID} value={d.DN_ID}>{d.DN_ID} — {d.Customer_Name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700">Select SKU ID <span className="text-red-500">*</span></label>
              <select
                value={selectedSKU}
                onChange={e => handleSKUChange(e.target.value)}
                disabled={!selectedDN || dnSkus.length === 0}
                className="w-full h-10 px-3 border border-input rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono disabled:opacity-50">
                <option value="">-- Select SKU --</option>
                {dnSkus.map(s => (
                  <option key={s.SKU_ID} value={s.SKU_ID}>
                    {s.SKU_ID} — {s.SKU_Description} (Ord: {s.Order_Quantity}){completedSKUs.has(s.SKU_ID) ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DN Summary strip */}
          {selectedDN && (
            <div className="flex flex-wrap gap-3 text-xs p-3 bg-muted/30 rounded-md border">
              <span>DN: <strong className="font-mono">{selectedDN}</strong></span>
              {dns.find(d => d.DN_ID === selectedDN) && (
                <>
                  <span>Customer: <strong>{dns.find(d => d.DN_ID === selectedDN)?.Customer_Name}</strong></span>
                  <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${statusColor(dns.find(d => d.DN_ID === selectedDN)?.Status || "")}`}>
                    {dns.find(d => d.DN_ID === selectedDN)?.Status}
                  </span>
                </>
              )}
              {selectedSKUObj && (
                <>
                  <span className="ml-auto">Order Qty: <strong className="text-primary">{orderQty}</strong></span>
                  <span>Picked: <strong className={totalPicked >= orderQty ? "text-green-600" : "text-orange-500"}>{totalPicked}</strong></span>
                  <span>Remaining: <strong className={closingOfSKU === 0 ? "text-green-600" : "text-red-500"}>{closingOfSKU}</strong></span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pallet Grid */}
      <Card className="shadow-sm">
        <CardHeader className="border-b py-3 px-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {loading ? "Loading pallets..." : pallets.length > 0 ? `${pallets.length} Pallets Available (FEFO order)` : "Select DN & SKU to view pallets"}
            </h3>
            {pallets.length > 0 && (
              <div className="flex gap-2">
                <button onClick={handleDefaultAssign}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  ⚡ Default Assign
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {isSubmitting ? "Saving..." : "✅ Submit Pick Assignment"}
                </button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {pallets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                    <th className="px-3 py-3 text-left">Pallet ID</th>
                    <th className="px-3 py-3 text-left">Location</th>
                    <th className="px-3 py-3 text-left">Batch</th>
                    <th className="px-3 py-3 text-left">Expiry</th>
                    <th className="px-3 py-3 text-right">Free Good</th>
                    <th className="px-3 py-3 text-right">Free Dmg</th>
                    <th className="px-3 py-3 text-right">Free Total</th>
                    <th className="px-3 py-3 text-right w-28">Pick Good</th>
                    <th className="px-3 py-3 text-right w-28">Pick Dmg</th>
                    <th className="px-3 py-3 text-right">Pick Total</th>
                    <th className="px-3 py-3 text-right">Closing Pallet</th>
                    <th className="px-3 py-3 text-center">Last?</th>
                  </tr>
                </thead>
                <tbody>
                  {pallets.map((p, idx) => {
                    const r = pickRows[p.Pallet_ID];
                    if (!r) return null;
                    const pickTotal = (r.Pick_Good_Box_Qty || 0) + (r.Pick_Damage_Box_Qty || 0);
                    const closingPallet = getClosingOfPallet(r);
                    const hasAnyPick = pickTotal > 0;
                    return (
                      <tr key={p.Pallet_ID}
                        className={`border-b transition-colors ${hasAnyPick ? "bg-green-50 border-l-4 border-l-green-500" : idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                        <td className="px-3 py-3 font-mono text-xs font-semibold">{p.Pallet_ID}</td>
                        <td className="px-3 py-3 text-xs font-mono">{p.Location_ID || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-3 text-xs">{p.Batch_Number || "—"}</td>
                        <td className="px-3 py-3 text-xs font-mono">{p.Expiry_Date || "—"}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">{p.Free_Good_Box_Qty}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-orange-600">{p.Free_Damage_Box_Qty}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-semibold">{p.Free_Total_Qty}</td>
                        {/* Pick inputs */}
                        <td className="px-2 py-2">
                          <input type="number" min="0" max={p.Free_Good_Box_Qty} value={r.Pick_Good_Box_Qty || ""}
                            onChange={e => updateRow(p.Pallet_ID, "Pick_Good_Box_Qty", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full h-8 px-2 text-right text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono bg-white" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" max={p.Free_Damage_Box_Qty} value={r.Pick_Damage_Box_Qty || ""}
                            onChange={e => updateRow(p.Pallet_ID, "Pick_Damage_Box_Qty", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full h-8 px-2 text-right text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono bg-white" />
                        </td>
                        <td className={`px-3 py-3 text-right font-mono text-sm font-bold ${hasAnyPick ? "text-green-700" : "text-muted-foreground"}`}>{pickTotal}</td>
                        <td className={`px-3 py-3 text-right font-mono text-xs ${closingPallet === 0 && hasAnyPick ? "text-orange-500 font-bold" : ""}`}>{closingPallet}</td>
                        <td className="px-3 py-3 text-center">
                          {r.Is_Last ? (
                            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Last</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold border-t-2">
                    <td colSpan={6} className="px-3 py-3 text-sm">Totals</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{pallets.reduce((s, p) => s + p.Free_Total_Qty, 0)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-green-700">{totalPickedGood}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-orange-600">{totalPickedDamage}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">{totalPicked}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-red-500">{closingOfSKU}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {loading ? (
                <span className="animate-pulse">Loading inventory pallets...</span>
              ) : selectedDN && selectedSKU ? (
                "No available pallets found for this SKU."
              ) : (
                "Select DN & SKU to view available pallets"
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SKU Completion Summary */}
      {selectedDN && dnSkus.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="border-b py-3 px-5">
            <h3 className="font-semibold text-sm">SKU Assignment Progress</h3>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {dnSkus.map(s => (
                <span key={s.SKU_ID}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${completedSKUs.has(s.SKU_ID) ? "bg-green-100 text-green-700 border-green-200" : s.SKU_ID === selectedSKU ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
                  {completedSKUs.has(s.SKU_ID) ? "✓ " : ""}{s.SKU_ID}
                  <span className="ml-1 opacity-70">(Ord: {s.Order_Quantity})</span>
                </span>
              ))}
            </div>
            {dnSkus.length > 0 && dnSkus.every(s => completedSKUs.has(s.SKU_ID)) && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm font-semibold">
                🎉 All SKUs assigned — DN status: Picklist Generated
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
