"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/* ── Types ─────────────────────────────────────────────────── */
interface DN { DN_ID: string; Customer_Name: string; Status: string; }
interface DNSKU { SKU_ID: string; SKU_Description: string; Order_Quantity: number; Line_No: string; }
interface Pallet {
  _key: string;           // unique row key: PalletID||GRNID||rowIdx
  Pallet_ID: string;
  GRN_ID: string;
  SKU_ID: string;
  SKU_Description: string;
  Batch_Number: string;
  Manufacturing_Date: string;
  Expiry_Date: string;
  Location_ID: string;
  Free_Good_Box_Qty: number;
  Free_Damage_Box_Qty: number;
  Free_Total_Qty: number;
  Pallet_Total_Qty: number;     // total qty across ALL skus on this pallet
  SKU_Count_In_Pallet: number;  // distinct SKU count on this pallet
}
interface PickRow extends Pallet {
  Pick_Good_Box_Qty: number;
  Pick_Damage_Box_Qty: number;
  Is_Last: boolean;
  overGood: boolean;            // validation flag
  overDamage: boolean;
}

/* ── Component ─────────────────────────────────────────────── */
export function PickAssignmentForm() {
  const { data: session } = useSession();
  void session;

  const [dns, setDns] = useState<DN[]>([]);
  const [dnSkus, setDnSkus] = useState<DNSKU[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);

  const [selectedDN, setSelectedDN] = useState("");
  const [selectedSKU, setSelectedSKU] = useState("");
  const [selectedSKUObj, setSelectedSKUObj] = useState<DNSKU | null>(null);

  const [searchPallet, setSearchPallet] = useState("");
  const [searchGRN, setSearchGRN] = useState("");
  const [searchBatch, setSearchBatch] = useState("");
  const [searchMfg, setSearchMfg] = useState("");
  const [searchExpiry, setSearchExpiry] = useState("");

  // keyed by _key (unique row key)
  const [pickRows, setPickRows] = useState<Record<string, PickRow>>({});

  const [pickIdBase, setPickIdBase] = useState("PICK-0001");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [completedSKUs, setCompletedSKUs] = useState<Set<string>>(new Set());

  // ── Initial load
  useEffect(() => {
    fetch("/api/pick-assignment/data").then(r => r.json()).then(d => {
      if (d.eligibleDns) setDns(d.eligibleDns);
    });
    fetch("/api/pick-assignment/generate-id").then(r => r.json()).then(d => {
      if (d.nextId) setPickIdBase(d.nextId);
    });
  }, []);

  // ── When DN changes
  useEffect(() => {
    setSelectedSKU(""); setSelectedSKUObj(null); setPallets([]); setPickRows({});
    setDnSkus([]); setSearchPallet(""); setSearchGRN("");
    if (!selectedDN) return;
    setLoading(true);
    fetch(`/api/pick-assignment/data?dnId=${encodeURIComponent(selectedDN)}`).then(r => r.json()).then(d => {
      setDnSkus(d.dnSkus || []);
    }).finally(() => setLoading(false));
  }, [selectedDN]);

  // ── When SKU changes: load pallets
  const loadPallets = useCallback(async (skuId: string) => {
    if (!skuId || !selectedDN) return;
    setLoading(true); setPallets([]); setPickRows({}); setSearchPallet(""); setSearchGRN(""); setSearchBatch(""); setSearchMfg(""); setSearchExpiry("");
    try {
      const d = await fetch(`/api/pick-assignment/data?dnId=${encodeURIComponent(selectedDN)}&skuId=${encodeURIComponent(skuId)}`).then(r => r.json());
      const ps: Pallet[] = (d.pallets || []).map((p: Pallet, idx: number) => ({
        ...p,
        _key: p._key || `${p.Pallet_ID}||${p.GRN_ID}||${idx}`,
      }));
      setPallets(ps);
      const rows: Record<string, PickRow> = {};
      ps.forEach(p => { rows[p._key] = { ...p, Pick_Good_Box_Qty: 0, Pick_Damage_Box_Qty: 0, Is_Last: false, overGood: false, overDamage: false }; });
      setPickRows(rows);
    } finally { setLoading(false); }
  }, [selectedDN]);

  const handleSKUChange = (skuId: string) => {
    setSelectedSKU(skuId);
    setSelectedSKUObj(dnSkus.find(s => s.SKU_ID === skuId) || null);
    loadPallets(skuId);
  };

  // ── Filtered pallets
  const filteredPallets = pallets.filter(p => {
    const pm = !searchPallet || p.Pallet_ID.toLowerCase().includes(searchPallet.toLowerCase());
    const gm = !searchGRN || p.GRN_ID.toLowerCase().includes(searchGRN.toLowerCase());
    const bm = !searchBatch || p.Batch_Number.toLowerCase().includes(searchBatch.toLowerCase());
    const mm = !searchMfg || p.Manufacturing_Date.toLowerCase().includes(searchMfg.toLowerCase());
    const em = !searchExpiry || p.Expiry_Date.toLowerCase().includes(searchExpiry.toLowerCase());
    return pm && gm && bm && mm && em;
  });

  const hasAnyFilter = searchPallet || searchGRN || searchBatch || searchMfg || searchExpiry;
  const clearAllFilters = () => { setSearchPallet(""); setSearchGRN(""); setSearchBatch(""); setSearchMfg(""); setSearchExpiry(""); };

  // ── Per-pallet total picks (shared across all rows of same Pallet_ID)
  const palletPickTotalMap: Record<string, number> = {};
  pallets.forEach(p => {
    const r = pickRows[p._key];
    const t = (r?.Pick_Good_Box_Qty || 0) + (r?.Pick_Damage_Box_Qty || 0);
    palletPickTotalMap[p.Pallet_ID] = (palletPickTotalMap[p.Pallet_ID] || 0) + t;
  });

  // ── Grand totals for footer / summary strip
  const totalPickedGood = Object.values(pickRows).reduce((s, r) => s + (r.Pick_Good_Box_Qty || 0), 0);
  const totalPickedDamage = Object.values(pickRows).reduce((s, r) => s + (r.Pick_Damage_Box_Qty || 0), 0);
  const totalPicked = totalPickedGood + totalPickedDamage;
  const orderQty = selectedSKUObj?.Order_Quantity || 0;
  const closingOfSKU = Math.max(0, orderQty - totalPicked);

  // ── Closing pallet = Pallet_Total_Qty − all picks from that pallet
  const closingPalletFor = (p: Pallet) =>
    Math.max(0, p.Pallet_Total_Qty - (palletPickTotalMap[p.Pallet_ID] || 0));

  // ── Auto-mark last picking pallet
  const withLastMarked = (rows: Record<string, PickRow>): Record<string, PickRow> => {
    const updated = { ...rows };
    pallets.forEach(p => { updated[p._key] = { ...updated[p._key], Is_Last: false }; });
    const active = pallets.filter(p => {
      const r = updated[p._key];
      return r && (r.Pick_Good_Box_Qty > 0 || r.Pick_Damage_Box_Qty > 0);
    });
    if (active.length > 0) {
      const lastKey = active[active.length - 1]._key;
      updated[lastKey] = { ...updated[lastKey], Is_Last: true };
    }
    return updated;
  };

  // ── Default Assign (FEFO)
  const handleDefaultAssign = () => {
    let remaining = orderQty;
    const newRows = { ...pickRows };
    pallets.forEach(p => {
      if (remaining <= 0) {
        newRows[p._key] = { ...newRows[p._key], Pick_Good_Box_Qty: 0, Pick_Damage_Box_Qty: 0, overGood: false, overDamage: false };
        return;
      }
      const assignGood = Math.min(p.Free_Good_Box_Qty, remaining);
      remaining -= assignGood;
      const assignDamage = Math.min(p.Free_Damage_Box_Qty, remaining);
      remaining -= assignDamage;
      newRows[p._key] = { ...newRows[p._key], Pick_Good_Box_Qty: assignGood, Pick_Damage_Box_Qty: assignDamage, overGood: false, overDamage: false };
    });
    setPickRows(withLastMarked(newRows));
  };

  const updateRow = (key: string, field: "Pick_Good_Box_Qty" | "Pick_Damage_Box_Qty", value: number) => {
    setPickRows(prev => {
      const row = prev[key];
      const safeVal = Math.max(0, value);
      const maxVal = field === "Pick_Good_Box_Qty" ? row.Free_Good_Box_Qty : row.Free_Damage_Box_Qty;
      const clamped = Math.min(safeVal, maxVal);
      const overLimit = safeVal > maxVal;
      const updated = {
        ...prev,
        [key]: {
          ...row,
          [field]: clamped,
          overGood: field === "Pick_Good_Box_Qty" ? overLimit : row.overGood,
          overDamage: field === "Pick_Damage_Box_Qty" ? overLimit : row.overDamage,
        }
      };
      return withLastMarked(updated);
    });
  };

  // ── Submit
  const handleSubmit = async () => {
    const activeRows = pallets.filter(p => {
      const r = pickRows[p._key];
      return r && (r.Pick_Good_Box_Qty > 0 || r.Pick_Damage_Box_Qty > 0);
    });
    if (activeRows.length === 0) return setErrorMsg("No pick quantities entered. Use Default Assign or enter quantities manually.");

    // Validate: no over-pick
    const overPick = activeRows.find(p => {
      const r = pickRows[p._key];
      return r.overGood || r.overDamage || r.Pick_Good_Box_Qty > p.Free_Good_Box_Qty || r.Pick_Damage_Box_Qty > p.Free_Damage_Box_Qty;
    });
    if (overPick) return setErrorMsg("One or more rows exceed the available free quantity. Please correct before submitting.");

    setIsSubmitting(true); setSuccessMsg(""); setErrorMsg("");
    try {
      const baseNum = parseInt(pickIdBase.replace("PICK-", ""), 10) || 1;
      const newlyCompleted = new Set(completedSKUs);
      newlyCompleted.add(selectedSKU);
      const allSkusDone = dnSkus.every(s => newlyCompleted.has(s.SKU_ID));

      const rows = activeRows.map((p, idx) => {
        const r = pickRows[p._key];
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
          Closing_of_Palet: closingPalletFor(p),
          SKU_Count_In_Pallet: p.SKU_Count_In_Pallet,
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

      setCompletedSKUs(newlyCompleted);
      setSuccessMsg(`✅ ${rows.length} pallets assigned for ${selectedSKU}${allSkusDone ? " — DN Status: Picklist Generated!" : ""}`);
      setSelectedSKU(""); setSelectedSKUObj(null); setPallets([]); setPickRows({});
      setSearchPallet(""); setSearchGRN("");
      fetch("/api/pick-assignment/generate-id").then(r => r.json()).then(d => d.nextId && setPickIdBase(d.nextId));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor = (s: string) => s === "Picklist Generated"
    ? "bg-green-100 text-green-700 border-green-200"
    : "bg-blue-100 text-blue-700 border-blue-200";

  const currentDN = dns.find(d => d.DN_ID === selectedDN);

  return (
    <div className="space-y-5">
      {/* ── Header Card ─────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">02 Pick Assignment — OB</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Assign inventory pallets to DN pick lines (FEFO order).</p>
            </div>
            <span className="font-mono text-sm font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">Next: {pickIdBase}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
          {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700">Select DN ID <span className="text-red-500">*</span></label>
              <select value={selectedDN}
                onChange={e => { setSelectedDN(e.target.value); setCompletedSKUs(new Set()); setSuccessMsg(""); setErrorMsg(""); }}
                className="w-full h-10 px-3 border border-input rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono">
                <option value="">-- Select DN --</option>
                {dns.map(d => <option key={d.DN_ID} value={d.DN_ID}>{d.DN_ID} — {d.Customer_Name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-700">Select SKU ID <span className="text-red-500">*</span></label>
              <select value={selectedSKU}
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

          {selectedDN && (
            <div className="flex flex-wrap gap-3 text-xs p-3 bg-muted/30 rounded-md border">
              <span>DN: <strong className="font-mono">{selectedDN}</strong></span>
              {currentDN && (
                <>
                  <span>Customer: <strong>{currentDN.Customer_Name}</strong></span>
                  <span className={`px-2 py-0.5 rounded border font-semibold ${statusColor(currentDN.Status)}`}>{currentDN.Status}</span>
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

      {/* ── Pallet Table ─────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="border-b py-3 px-5">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                {loading ? "Loading..." : pallets.length > 0
                  ? `${filteredPallets.length} / ${pallets.length} Pallets (FEFO)`
                  : "Select DN & SKU to view pallets"}
              </h3>
              {pallets.length > 0 && (
                <>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                    <Input placeholder="Pallet ID..." value={searchPallet} onChange={e => setSearchPallet(e.target.value)}
                      className="h-8 pl-7 pr-3 text-xs w-36 font-mono" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                    <Input placeholder="GRN ID..." value={searchGRN} onChange={e => setSearchGRN(e.target.value)}
                      className="h-8 pl-7 pr-3 text-xs w-32 font-mono" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                    <Input placeholder="Batch..." value={searchBatch} onChange={e => setSearchBatch(e.target.value)}
                      className="h-8 pl-7 pr-3 text-xs w-28 font-mono" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                    <Input placeholder="Mfg Date..." value={searchMfg} onChange={e => setSearchMfg(e.target.value)}
                      className="h-8 pl-7 pr-3 text-xs w-28 font-mono" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                    <Input placeholder="Expiry..." value={searchExpiry} onChange={e => setSearchExpiry(e.target.value)}
                      className="h-8 pl-7 pr-3 text-xs w-28 font-mono" />
                  </div>
                  {hasAnyFilter && (
                    <button onClick={clearAllFilters}
                      className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap">Clear all</button>
                  )}
                </>
              )}
            </div>
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
                    <th className="px-3 py-3 text-left whitespace-nowrap">Pallet ID</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">GRN ID</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Location</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Batch</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Mfg Date</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Expiry</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Free Good</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Free Dmg</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Free Total</th>
                    <th className="px-3 py-3 text-right w-28 whitespace-nowrap">Pick Good</th>
                    <th className="px-3 py-3 text-right w-28 whitespace-nowrap">Pick Dmg</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Pick Total</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap" title="Pallet_Total_Qty − all picks from this pallet">Closing Pallet</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap" title="Order_Qty − total picked so far for this SKU">Closing SKU</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap" title="SKU count on this pallet"># SKUs</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Last?</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPallets.length === 0 ? (
                    <tr><td colSpan={15} className="text-center py-8 text-muted-foreground text-sm">No pallets match your search.</td></tr>
                  ) : filteredPallets.map((p, idx) => {
                    const r = pickRows[p._key];
                    if (!r) return null;
                    const pickTotal = (r.Pick_Good_Box_Qty || 0) + (r.Pick_Damage_Box_Qty || 0);
                    const closingPallet = closingPalletFor(p);
                    const hasAnyPick = pickTotal > 0;
                    const hasError = r.overGood || r.overDamage;
                    return (
                      <tr key={p._key}
                        className={`border-b transition-colors ${hasError ? "bg-red-50 border-l-4 border-l-red-500" : hasAnyPick ? "bg-green-50 border-l-4 border-l-green-500" : idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold whitespace-nowrap">{p.Pallet_ID}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-blue-700 whitespace-nowrap">{p.GRN_ID || "—"}</td>
                        <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">{p.Location_ID || "—"}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.Batch_Number || "—"}</td>
                        <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">{p.Manufacturing_Date || "—"}</td>
                        <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">{p.Expiry_Date || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{p.Free_Good_Box_Qty}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-orange-600">{p.Free_Damage_Box_Qty}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">{p.Free_Total_Qty}</td>
                        {/* Pick Good input */}
                        <td className="px-2 py-2">
                          <div className="relative">
                            <input type="number" min="0" max={p.Free_Good_Box_Qty}
                              value={r.Pick_Good_Box_Qty || ""}
                              onChange={e => updateRow(p._key, "Pick_Good_Box_Qty", parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className={`w-full h-8 px-2 text-right text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono bg-white ${r.overGood ? "border-red-500 text-red-600" : "border-input"}`} />
                            {r.overGood && (
                              <span className="absolute -bottom-4 right-0 text-[10px] text-red-600 whitespace-nowrap">
                                Max: {p.Free_Good_Box_Qty}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Pick Damage input */}
                        <td className="px-2 py-2">
                          <div className="relative">
                            <input type="number" min="0" max={p.Free_Damage_Box_Qty}
                              value={r.Pick_Damage_Box_Qty || ""}
                              onChange={e => updateRow(p._key, "Pick_Damage_Box_Qty", parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className={`w-full h-8 px-2 text-right text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono bg-white ${r.overDamage ? "border-red-500 text-red-600" : "border-input"}`} />
                            {r.overDamage && (
                              <span className="absolute -bottom-4 right-0 text-[10px] text-red-600 whitespace-nowrap">
                                Max: {p.Free_Damage_Box_Qty}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${hasAnyPick ? "text-green-700" : "text-muted-foreground"}`}>{pickTotal}</td>
                        {/* Closing Pallet */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${closingPallet === 0 && hasAnyPick ? "text-orange-500" : ""}`}>
                          {closingPallet}
                          <span className="block text-[10px] text-muted-foreground font-normal">of {p.Pallet_Total_Qty}</span>
                        </td>
                        {/* Closing SKU — same for every row since it's SKU-level */}
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${closingOfSKU === 0 ? "text-green-600" : closingOfSKU < 0 ? "text-red-600" : "text-amber-600"}`}>
                          {closingOfSKU}
                          <span className="block text-[10px] text-muted-foreground font-normal">of {orderQty}</span>
                        </td>
                        {/* SKU count on pallet */}
                        <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-purple-700">
                          {p.SKU_Count_In_Pallet}
                          <span className="block text-[10px] text-muted-foreground font-normal">SKU{p.SKU_Count_In_Pallet !== 1 ? "s" : ""}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {r.Is_Last
                            ? <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Last</span>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold border-t-2">
                    <td colSpan={9} className="px-3 py-3 text-sm">Totals ({filteredPallets.length} shown)</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-green-700">{totalPickedGood}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-orange-600">{totalPickedDamage}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">{totalPicked}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-muted-foreground">—</td>
                    <td className={`px-3 py-3 text-right font-mono text-sm font-bold ${closingOfSKU === 0 ? "text-green-600" : "text-amber-600"}`}>{closingOfSKU}</td>
                    <td></td><td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {loading ? <span className="animate-pulse">Loading inventory pallets...</span>
                : selectedDN && selectedSKU ? "No available pallets found for this SKU."
                : "Select DN & SKU to view available pallets"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SKU Progress ─────────────────────────────────── */}
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
                🎉 All SKUs assigned — DN Status: Picklist Generated
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
