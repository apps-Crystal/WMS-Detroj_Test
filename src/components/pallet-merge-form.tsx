"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface InvRow {
  GRN_ID: string;
  SKU_ID: string;
  SKU_Description: string;
  Batch_Number: string;
  Manufacturing_Date: string;
  Expiry_Date: string;
  Good_Box_Qty: number;
  Damage_Box_Qty: number;
  Current_Qty: number;
  Free_Good_Box_Qty?: number;
  Free_Damage_Box_Qty?: number;
  Free_Total_Qty: number;
}

interface PalletDetail {
  palletId: string;
  rows: InvRow[];
  location: string;
  occupancy: string;
  assignment: string;
}

interface MoveReq {
  moveGood: number;
  moveDmg: number;
}

function PalletPreviewCard({
  label, color, detail, loading, onSearch, moves, onMoveChange
}: {
  label: string; color: "blue" | "green";
  detail: PalletDetail | null; loading: boolean;
  onSearch: (id: string) => void;
  moves?: MoveReq[];
  onMoveChange?: (index: number, moveGood: number, moveDmg: number) => void;
}) {
  const [input, setInput] = useState("");
  const totalQty = detail?.rows.reduce((s, r) => s + r.Current_Qty, 0) ?? 0;
  const colorCls = color === "blue" ? "border-blue-300 bg-blue-50/50" : "border-green-300 bg-green-50/50";
  const hdrCls   = color === "blue" ? "bg-blue-600 text-white" : "bg-green-600 text-white";

  return (
    <div className={`rounded-xl border-2 ${colorCls} overflow-hidden flex flex-col`}>
      <div className={`${hdrCls} px-4 py-3 flex items-center gap-3`}>
        <span className="text-sm font-bold uppercase tracking-wide">{label} Pallet</span>
        {detail && <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">{detail.palletId}</span>}
      </div>
      <div className="px-4 py-3 bg-white/60 border-b flex gap-2">
        <Input
          placeholder="Enter Pallet ID..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && input.trim() && onSearch(input.trim())}
          className="font-mono text-sm h-9"
        />
        <button
          onClick={() => input.trim() && onSearch(input.trim())}
          disabled={loading || !input.trim()}
          className="px-4 h-9 text-sm font-semibold bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
        >
          {loading ? "⏳" : "🔍 Load"}
        </button>
      </div>

      <div className="p-4 flex-1 overflow-x-auto">
        {loading && <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">Loading pallet data...</div>}
        {!loading && !detail && <div className="text-center py-8 text-muted-foreground text-sm">Enter a Pallet ID and click Load</div>}
        {!loading && detail && (
          <>
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-semibold border ${detail.occupancy.includes("Unoccupied") ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                {detail.occupancy || "—"}
              </span>
              {detail.location && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border font-mono">{detail.location}</span>}
              {detail.assignment && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{detail.assignment}</span>}
              <span className="ml-auto font-semibold">Total: {totalQty} units across {detail.rows.length} rows</span>
            </div>

            {detail.rows.length === 0 ? (
              <div className="text-center py-4 text-red-500 text-sm font-semibold">⚠ No inventory rows found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-700 text-white text-[10px] uppercase">
                      <th className="px-2 py-1.5 text-left border border-slate-600">SKU</th>
                      <th className="px-2 py-1.5 text-left border border-slate-600">Batch</th>
                      <th className="px-2 py-1.5 text-left border border-slate-600">Expiry</th>
                      <th className="px-2 py-1.5 text-right border border-slate-600" title="Good (Free)">Good (Free)</th>
                      <th className="px-2 py-1.5 text-right border border-slate-600" title="Damage (Free)">Dmg (Free)</th>
                      {onMoveChange && (
                        <>
                          <th className="px-2 py-1.5 text-right border border-slate-600 text-indigo-200 bg-indigo-900 border-l-2 border-l-indigo-400">🔀 Move G</th>
                          <th className="px-2 py-1.5 text-right border border-slate-600 text-indigo-200 bg-indigo-900">🔀 Move D</th>
                        </>
                      )}
                      <th className="px-2 py-1.5 text-right border border-slate-600 font-bold border-l-2 border-l-slate-400">Cur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((r, i) => {
                      const freeG = r.Free_Good_Box_Qty ?? r.Good_Box_Qty;
                      const freeD = r.Free_Damage_Box_Qty ?? r.Damage_Box_Qty;
                      return (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-2 py-1.5 border border-slate-200 font-mono font-semibold max-w-[120px] overflow-hidden text-ellipsis">
                            {r.SKU_ID}
                            <span className="block text-[9px] text-muted-foreground font-normal truncate max-w-[120px]">{r.SKU_Description}</span>
                          </td>
                          <td className="px-2 py-1.5 border border-slate-200">{r.Batch_Number || "—"}</td>
                          <td className="px-2 py-1.5 border border-slate-200 font-mono">{r.Expiry_Date || "—"}</td>
                          <td className="px-2 py-1.5 border border-slate-200 text-right text-green-700 font-mono">
                            {r.Good_Box_Qty} <span className="text-[9px] text-muted-foreground">({freeG})</span>
                          </td>
                          <td className="px-2 py-1.5 border border-slate-200 text-right text-orange-600 font-mono">
                            {r.Damage_Box_Qty} <span className="text-[9px] text-muted-foreground">({freeD})</span>
                          </td>
                          {onMoveChange && (
                            <>
                              <td className="px-1 py-1 border border-slate-200 text-right bg-indigo-50 border-l-2 border-l-indigo-200">
                                <input
                                  type="number"
                                  className="w-14 text-right border border-indigo-200 rounded px-1 py-0.5 text-xs font-mono font-semibold text-indigo-700 focus:outline-indigo-500"
                                  min={0}
                                  max={freeG}
                                  value={moves?.[i]?.moveGood ?? 0}
                                  onChange={e => {
                                    let val = Number(e.target.value);
                                    if (val < 0) val = 0;
                                    if (val > freeG) val = freeG;
                                    onMoveChange(i, val, moves?.[i]?.moveDmg ?? 0);
                                  }}
                                />
                              </td>
                              <td className="px-1 py-1 border border-slate-200 text-right bg-indigo-50">
                                <input
                                  type="number"
                                  className="w-14 text-right border border-indigo-200 rounded px-1 py-0.5 text-xs font-mono font-semibold text-indigo-700 focus:outline-indigo-500"
                                  min={0}
                                  max={freeD}
                                  value={moves?.[i]?.moveDmg ?? 0}
                                  onChange={e => {
                                    let val = Number(e.target.value);
                                    if (val < 0) val = 0;
                                    if (val > freeD) val = freeD;
                                    onMoveChange(i, moves?.[i]?.moveGood ?? 0, val);
                                  }}
                                />
                              </td>
                            </>
                          )}
                          <td className="px-2 py-1.5 border border-slate-200 text-right font-bold font-mono border-l-2 border-l-slate-300">
                            {r.Current_Qty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td colSpan={3} className="px-2 py-1 text-xs font-semibold">TOTAL</td>
                      <td className="px-2 py-1 text-right font-mono text-xs">{detail.rows.reduce((s,r)=>s+r.Good_Box_Qty,0)}</td>
                      <td className="px-2 py-1 text-right font-mono text-xs">{detail.rows.reduce((s,r)=>s+r.Damage_Box_Qty,0)}</td>
                      {onMoveChange && (
                        <>
                          <td className="px-2 py-1 text-right font-mono text-xs text-indigo-300 border-l-2 border-l-indigo-500">
                            {moves?.reduce((s,m)=>s+(m.moveGood||0), 0)}
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs text-indigo-300">
                            {moves?.reduce((s,m)=>s+(m.moveDmg||0), 0)}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1 text-right font-mono font-bold text-xs border-l-2 border-l-slate-500">{totalQty}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PalletMergeForm() {
  const [srcDetail, setSrcDetail] = useState<PalletDetail | null>(null);
  const [dstDetail, setDstDetail] = useState<PalletDetail | null>(null);
  const [moves, setMoves] = useState<MoveReq[]>([]);
  const [loadingSrc, setLoadingSrc] = useState(false);
  const [loadingDst, setLoadingDst] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; log?: string[] } | null>(null);

  const fetchPallet = useCallback(async (
    palletId: string,
    setDetail: (d: PalletDetail | null) => void,
    setLoading: (b: boolean) => void,
    isSource: boolean = false
  ) => {
    setLoading(true); setDetail(null); setResult(null);
    if (isSource) setMoves([]);
    try {
      const res = await fetch(`/api/pallet-merge?palletId=${encodeURIComponent(palletId)}`);
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Failed");
      setDetail(data);
      if (isSource && data.rows) {
        // Init moves to the total FREE quantities
        setMoves(data.rows.map((r: InvRow) => ({
          moveGood: r.Free_Good_Box_Qty ?? r.Good_Box_Qty,
          moveDmg: r.Free_Damage_Box_Qty ?? r.Damage_Box_Qty
        })));
      }
    } catch (e: unknown) {
      setResult({ success: false, message: e instanceof Error ? e.message : "Error loading pallet" });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMerge = async () => {
    if (!srcDetail || !dstDetail) return;
    if (srcDetail.palletId === dstDetail.palletId) {
      return setResult({ success: false, message: "Source and destination pallets must be different." });
    }
    const totalMoveQty = moves.reduce((s, m) => s + m.moveGood + m.moveDmg, 0);
    if (totalMoveQty === 0) {
      return setResult({ success: false, message: "No quantities selected to move." });
    }

    setMerging(true); setResult(null);
    try {
      const res = await fetch("/api/pallet-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sourcePalletId: srcDetail.palletId, 
          destinationPalletId: dstDetail.palletId,
          moves: moves
        }),
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "Merge failed");
      setResult({ success: true, message: data.message, log: data.log });
      
      // Refresh both pallets to show updated quantities
      setTimeout(() => {
        fetchPallet(dstDetail.palletId, setDstDetail, setLoadingDst, false);
        fetchPallet(srcDetail.palletId, setSrcDetail, setLoadingSrc, true);
      }, 500);
    } catch (e: unknown) {
      setResult({ success: false, message: e instanceof Error ? e.message : "Merge failed" });
    } finally {
      setMerging(false);
    }
  };

  const handleMoveChange = (idx: number, mg: number, md: number) => {
    const newMoves = [...moves];
    newMoves[idx] = { moveGood: mg, moveDmg: md };
    setMoves(newMoves);
  };

  const canMerge = srcDetail && dstDetail && srcDetail.palletId !== dstDetail.palletId && srcDetail.rows.length > 0;
  
  const moveTotalUnits = moves.reduce((s, m) => s + (m.moveGood || 0) + (m.moveDmg || 0), 0);
  const srcTotalUnits = srcDetail?.rows.reduce((s, r) => s + r.Current_Qty, 0) ?? 0;
  const dstTotalUnits = dstDetail?.rows.reduce((s, r) => s + r.Current_Qty, 0) ?? 0;

  return (
    <div className="space-y-5">
      <Card className="shadow-sm">
        <CardHeader className="border-b py-4 px-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">M</div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Pallet Merge <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Partial / Full</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Consolidate inventory from a Source pallet into a Destination pallet.
                Adjust the "Move G" / "Move D" inputs to merge specific quantities.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Result banner */}
      {result && (
        <div className={`p-4 rounded-xl border text-sm ${result.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          <div className="font-semibold">{result.success ? "✅" : "❌"} {result.message}</div>
          {result.log && result.log.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs max-h-40 overflow-y-auto">
              {result.log.map((l, i) => <li key={i} className="text-muted-foreground font-mono">→ {l}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Side-by-side pallet cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PalletPreviewCard
          label="Source (Pick Qty)" color="blue"
          detail={srcDetail} loading={loadingSrc}
          onSearch={(id) => fetchPallet(id, setSrcDetail, setLoadingSrc, true)}
          moves={moves}
          onMoveChange={handleMoveChange}
        />

        {/* Merge arrow */}
        <div className="xl:hidden flex items-center justify-center py-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span>↓ Merge quantities into ↓</span>
          </div>
        </div>

        <PalletPreviewCard
          label="Destination" color="green"
          detail={dstDetail} loading={loadingDst}
          onSearch={(id) => fetchPallet(id, setDstDetail, setLoadingDst, false)}
        />
      </div>

      {/* Merge preview summary */}
      {canMerge && (
        <Card className="shadow-sm border-indigo-200 bg-indigo-50/50">
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold text-indigo-800 mb-3">🔀 Operation Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm mb-4">
              <div className="text-center p-3 bg-blue-100 rounded-lg">
                <div className="font-mono font-bold text-blue-800">{srcDetail!.palletId}</div>
                <div className="text-xs text-blue-600 mt-0.5">Source Balance After:</div>
                <div className="font-bold text-lg mt-1 text-slate-700">{srcTotalUnits - moveTotalUnits}</div>
              </div>
              <div className="flex flex-col items-center justify-center text-indigo-600 font-bold">
                <div className="text-2xl animate-pulse">→</div>
                <div className="text-xs bg-indigo-200 px-2 py-0.5 rounded-full mt-1 font-mono uppercase">Moving {moveTotalUnits} units</div>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg">
                <div className="font-mono font-bold text-green-800">{dstDetail!.palletId}</div>
                <div className="text-xs text-green-600 mt-0.5">Destination Balance After:</div>
                <div className="font-bold text-lg mt-1 text-green-800">
                  {dstTotalUnits + moveTotalUnits}
                </div>
              </div>
            </div>
            <button
              onClick={handleMerge}
              disabled={merging || moveTotalUnits === 0}
              className="w-full py-3 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow"
            >
              {merging
                ? <><span className="animate-spin inline-block">⏳</span> Processing...</>
                : <>🔀 Execute Move: {moveTotalUnits} units from {srcDetail!.palletId} to {dstDetail!.palletId}</>}
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              Source row(s) are permanently deleted only if their total good &amp; damage quantities are entirely moved and there are no reserved items.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
