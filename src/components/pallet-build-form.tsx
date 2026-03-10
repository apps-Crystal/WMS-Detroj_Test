"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp, convertInputDate } from "@/lib/dateUtils";
import { ScanBarcode, Download } from "lucide-react";

interface BuiltPallet {
  GRN_ID: string;
  Pallet_ID: string;
  SKU_ID: string;
  SKU_Description: string;
  Batch_Number: string;
  Manufacturing_Date: string;
  Expiry_Date: string;
  Good_Box_Qty: string;
  Damage_Box_Qty: string;
  Total_Received_Qty_Boxes: string;
}

interface PendingGRN {
  GRN_ID: string;
  Vehicle_Number: string;
  LR_Number: string;
  Invoice_Number: string;
}

interface SKU {
  sku_id: string;
  description: string;
}

function ToggleGroup({
  options,
  value,
  onChange,
  colorMap,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => {
        const isSelected = value === opt;
        const color = colorMap?.[opt] || "bg-primary text-primary-foreground";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-5 py-2.5 rounded-md border text-sm font-medium transition-all ${
              isSelected
                ? `${color} border-transparent shadow-sm`
                : "bg-background border-border hover:bg-muted text-foreground"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function PalletBuildForm() {
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<PendingGRN[]>([]);
  const [pallets, setPallets] = useState<string[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [builtPallets, setBuiltPallets] = useState<BuiltPallet[]>([]);
  const [loadingPallets, setLoadingPallets] = useState(false);

  // Form State
  const [selectedGRN, setSelectedGRN] = useState<PendingGRN | null>(null);
  const [grnSearch, setGrnSearch] = useState("");
  const [showGrnDrop, setShowGrnDrop] = useState(false);
  const grnRef = useRef<HTMLDivElement>(null);

  const [palletSearch, setPalletSearch] = useState("");
  const [showPalletDrop, setShowPalletDrop] = useState(false);
  const palletRef = useRef<HTMLDivElement>(null);

  const [skuSearch, setSkuSearch] = useState("");
  const [showSkuDrop, setShowSkuDrop] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(null);
  const skuRef = useRef<HTMLDivElement>(null);

  const [batchNo, setBatchNo] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  
  const [totalBoxQty, setTotalBoxQty] = useState("");
  const [damageBoxQty, setDamageBoxQty] = useState("");
  
  const [wrapping, setWrapping] = useState("");
  const [vehicleCompleted, setVehicleCompleted] = useState("N");
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [builtBy, setBuiltBy] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (session?.user?.name) setBuiltBy(session.user.name);
    else if (session?.user?.email) setBuiltBy(session.user.email);
  }, [session]);

  useEffect(() => {
    Promise.all([
      fetch("/api/pallet-build/grns", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/pallets", { cache: "no-store" }).then(r => r.json())
    ])
      .then(([grnData, palletData]) => {
        if (grnData.grns) setGrns(grnData.grns);
        if (palletData.pallets) setPallets(palletData.pallets);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGRN) {
      setSkus([]);
      return;
    }
    // Fetch specific SKUs from GRN_Detail_IB_02 based on selected GRN
    fetch(`/api/pallet-build/grn-skus?grnId=${encodeURIComponent(selectedGRN.GRN_ID)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data.skus) setSkus(data.skus);
      })
      .catch(console.error);

    fetchBuiltPallets(selectedGRN.GRN_ID);
  }, [selectedGRN]);

  const fetchBuiltPallets = async (grnId: string) => {
    setLoadingPallets(true);
    try {
      const res = await fetch(`/api/pallet-build/built-pallets?grnId=${encodeURIComponent(grnId)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.pallets) setBuiltPallets(data.pallets);
    } catch (err) {
      console.error("Failed to fetch built pallets:", err);
    } finally {
      setLoadingPallets(false);
    }
  };

  // Outside click handlers
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (grnRef.current && !grnRef.current.contains(e.target as Node)) setShowGrnDrop(false);
      if (palletRef.current && !palletRef.current.contains(e.target as Node)) setShowPalletDrop(false);
      if (skuRef.current && !skuRef.current.contains(e.target as Node)) setShowSkuDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Filter lists
  const filteredGRNs = grns.filter(g =>
    g.GRN_ID.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Vehicle_Number?.toLowerCase().includes(grnSearch.toLowerCase())
  );
  
  const filteredPallets = pallets.filter(p => !palletSearch || p.toLowerCase().includes(palletSearch.toLowerCase()));
  
  const filteredSKUs = skus.filter(s => 
    s.sku_id.toLowerCase().includes(skuSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const selectGRN = (grn: PendingGRN) => { 
    setSelectedGRN(grn); 
    setGrnSearch(grn.GRN_ID); 
    setShowGrnDrop(false); 
    
    // Clear previously selected SKU and loaded pallets
    setSkuSearch("");
    setSelectedSKU(null);
    setBuiltPallets([]);
  };
  const selectPallet = (p: string) => { setPalletSearch(p); setShowPalletDrop(false); };
  const selectSKU = (sku: SKU) => { setSelectedSKU(sku); setSkuSearch(sku.sku_id); setShowSkuDrop(false); };

  const PALLET_FOLDER_ID = "1KV9b9RAVZIZAaUJopuTUIDdgukt7Xffw";

  const uploadPhoto = async (): Promise<string> => {
    if (!photoFile) return "";
    try {
      const fd = new FormData();
      fd.append("file", photoFile);
      fd.append("folderId", PALLET_FOLDER_ID);
      const res = await fetch("/api/upload-file", { method: "POST", body: fd });
      if (!res.ok) return "";
      const d = await res.json();
      return d.url || "";
    } catch { return ""; }
  };

  const totalBoxes = parseFloat(totalBoxQty) || 0;
  const parsedDamage = parseFloat(damageBoxQty) || 0;
  const computedGoodBoxes = totalBoxes - parsedDamage;
  const goodBoxesFinal = computedGoodBoxes >= 0 ? computedGoodBoxes : 0;
  
  const palletGRN = (selectedGRN && palletSearch) ? `${selectedGRN.GRN_ID}-${palletSearch}` : "";

  const handleSubmit = async () => {
    if (!selectedGRN) { setErrorMsg("Please select a GRN."); return; }
    if (!palletSearch) { setErrorMsg("Please scan or select a Pallet ID."); return; }
    if (!selectedSKU) { setErrorMsg("Please select an SKU."); return; }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const url = await uploadPhoto();
      const payload = {
        GRN_ID: selectedGRN.GRN_ID,
        Vehicle_Number: selectedGRN.Vehicle_Number,
        Pallet_ID: palletSearch,
        Pallet_GRN: palletGRN,
        Timestamp: formatTimestamp(),
        Built_By: builtBy,
        SKU_ID: selectedSKU.sku_id,
        SKU_Description: selectedSKU.description,
        Batch_Number: batchNo,
        Manufacturing_Date: convertInputDate(mfgDate),
        Expiry_Date: convertInputDate(expDate),
        Good_Box_Qty: goodBoxesFinal,
        Damage_Box_Qty: parsedDamage,
        Total_Received_Qty_Boxes: totalBoxes,
        Wrapping: wrapping,
        Photos_URL: url,
        Remarks: remarks,
        Vehicle_Completed: vehicleCompleted === "Y",
      };

      const res = await fetch("/api/pallet-build/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.status !== "success") throw new Error(result.message || "Submission failed");

      setSuccessMsg(`✅ Pallet ${palletSearch} built! GRN ${selectedGRN.GRN_ID} status updated.`);
      
      const currentGrnId = selectedGRN.GRN_ID;
      
      if (vehicleCompleted === "Y") {
        setGrns(prev => prev.filter(g => g.GRN_ID !== currentGrnId)); // Remove if complete
        setSelectedGRN(null);
        setGrnSearch("");
      } else {
        fetchBuiltPallets(currentGrnId);
      }
      
      // Remove used pallet
      setPallets(prev => prev.filter(p => p !== palletSearch));

      // Quick reset of form parts
      setPalletSearch(""); setSkuSearch(""); setSelectedSKU(null);
      setBatchNo(""); setMfgDate(""); setExpDate("");
      setTotalBoxQty(""); setDamageBoxQty(""); setWrapping("");
      setPhotoFile(null); setRemarks(""); setVehicleCompleted("N");
      
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center truncate">
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );

  const exportCSV = () => {
    if (builtPallets.length === 0) return;
    const headers = ["GRN_ID", "Pallet_ID", "SKU_ID", "SKU_Description", "Batch_Number", "Manufacturing_Date", "Expiry_Date", "Good_Box_Qty", "Damage_Box_Qty", "Total_Received_Qty_Boxes"];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + builtPallets.map(p => 
          [p.GRN_ID, p.Pallet_ID, p.SKU_ID, `"${p.SKU_Description}"`, p.Batch_Number, p.Manufacturing_Date, p.Expiry_Date, p.Good_Box_Qty, p.Damage_Box_Qty, p.Total_Received_Qty_Boxes].join(",")
      ).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pallets_${selectedGRN?.GRN_ID || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_600px] gap-6 items-start">
    <Card className="w-full">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">03 Pallet Build - 1 Pallet / 1 SKU</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${grns.length} active unloaded GRNs, ${pallets.length} available pallets`}
        </p>
      </CardHeader>

      <CardContent className="pt-6 space-y-7">
        {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
        {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

        {/* GRN_ID */}
        <div className="space-y-2">
          <Label className="font-semibold text-blue-700 flex justify-between items-center">
            <span>GRN_ID <span className="text-red-500">*</span></span>
            {selectedGRN && (
              <button 
                type="button" 
                onClick={() => { setSelectedGRN(null); setGrnSearch(""); setSkus([]); }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Change GRN
              </button>
            )}
          </Label>
          <div className="relative" ref={grnRef}>
            {selectedGRN ? (
              <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono items-center shadow-inner cursor-not-allowed text-muted-foreground">
                {selectedGRN.GRN_ID}
              </div>
            ) : (
              <Input
                placeholder="Search active GRN..."
                value={grnSearch}
                onChange={e => { setGrnSearch(e.target.value); setShowGrnDrop(true); }}
                onFocus={() => setShowGrnDrop(true)}
                className="font-mono bg-white"
                autoFocus
              />
            )}
            
            {showGrnDrop && !selectedGRN && filteredGRNs.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filteredGRNs.map(grn => (
                  <button key={grn.GRN_ID} type="button" onClick={() => selectGRN(grn)}
                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0">
                    <div className="font-mono font-semibold text-sm">{grn.GRN_ID}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {grn.Vehicle_Number} · Invoice: {grn.Invoice_Number}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showGrnDrop && !selectedGRN && grnSearch && filteredGRNs.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-sm px-4 py-3 text-sm text-muted-foreground">
                No active GRNs found (Check Vehicle Docked status)
              </div>
            )}
          </div>
        </div>

        {selectedGRN && (<>
          {/* Auto Filled Base Info */}
          <div className="grid grid-cols-3 gap-4">
            <ReadOnlyField label="Vehicle_Number" value={selectedGRN.Vehicle_Number} />
            <ReadOnlyField label="LR_Number" value={selectedGRN.LR_Number} />
            <ReadOnlyField label="Invoice_Number" value={selectedGRN.Invoice_Number} />
          </div>

          <div className="border-t my-4" />

          {/* Pallet Selection & Generation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-blue-700 flex items-center gap-1">
                Pallet_ID <span className="text-red-500">*</span>
                <ScanBarcode className="w-4 h-4 ml-2 text-muted-foreground" />
              </Label>
              <div className="relative" ref={palletRef}>
                <Input
                  placeholder="Scan or Search Pallet..."
                  value={palletSearch}
                  onChange={e => { setPalletSearch(e.target.value); setShowPalletDrop(true); }}
                  onFocus={() => setShowPalletDrop(true)}
                  className="font-mono"
                  autoFocus // Good for barcode scanner input right away
                />
                {showPalletDrop && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                    {filteredPallets.slice(0, 50).map(p => (
                      <button key={p} type="button" onClick={() => selectPallet(p)}
                        className="w-full px-4 py-2 text-left hover:bg-accent border-b last:border-0 font-mono text-sm">
                        {p}
                      </button>
                    ))}
                    {filteredPallets.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No unoccupied pallets remaining.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Pallet_GRN <span className="text-red-500">*</span></Label>
              <Input value={palletGRN} readOnly className="bg-muted font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timestamp</Label>
              <Input value={formatTimestamp()} readOnly className="bg-muted font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Built_By</Label>
              <Input value={builtBy} onChange={e => setBuiltBy(e.target.value)} readOnly />
            </div>
          </div>

          <div className="border-t my-4" />

          {/* SKU Selection */}
          <div className="space-y-2">
            <Label className="font-semibold text-blue-700">SKU_ID <span className="text-red-500">*</span></Label>
            <div className="relative" ref={skuRef}>
              <Input
                placeholder="Search SKU..."
                value={skuSearch}
                onChange={e => { setSkuSearch(e.target.value); setShowSkuDrop(true); setSelectedSKU(null); }}
                onFocus={() => setShowSkuDrop(true)}
                className="font-mono"
              />
              {showSkuDrop && filteredSKUs.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                  {filteredSKUs.slice(0, 30).map(s => (
                    <button key={s.sku_id} type="button" onClick={() => selectSKU(s)}
                      className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0">
                      <div className="font-mono font-semibold text-sm">{s.sku_id}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>SKU_Description <span className="text-red-500">*</span></Label>
            <Input value={selectedSKU?.description || ""} readOnly className="bg-muted" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-blue-700">Batch_Number <span className="text-red-500">*</span></Label>
              <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Manufacturing_Date</Label>
              <Input type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiry_Date</Label>
              <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border p-3 rounded-md bg-muted/20">
            <div className="space-y-2">
              <Label className="text-blue-700">Total_Quantity_Boxes <span className="text-red-500">*</span></Label>
              <Input type="number" min="0" value={totalBoxQty} onChange={e => setTotalBoxQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-red-600">Damage_Boxes</Label>
              <Input type="number" min="0" value={damageBoxQty} onChange={e => setDamageBoxQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-green-700">Good_Boxes</Label>
              <Input value={goodBoxesFinal} readOnly className="bg-muted font-bold text-lg text-green-700" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Wrapping</Label>
            <ToggleGroup
              options={["Belt", "Shrink Wrap", "Not Done"]}
              value={wrapping}
              onChange={setWrapping}
              colorMap={{ "Belt": "bg-blue-600 text-white", "Shrink Wrap": "bg-blue-600 text-white", "Not Done": "bg-gray-400 text-white" }}
            />
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <Label>Photos_URL</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
                📷 {photoFile ? photoFile.name : "Choose Photo..."}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
              {photoFile && <span className="text-xs text-green-600">Ready</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="space-y-2 pt-2">
            <Label className="font-semibold text-lg text-red-600">Vehicle_Completed?</Label>
            <ToggleGroup
              options={["N", "Y"]}
              value={vehicleCompleted}
              onChange={setVehicleCompleted}
              colorMap={{ "N": "bg-primary text-primary-foreground", "Y": "bg-red-600 text-white" }}
            />
            <p className="text-xs text-muted-foreground mt-1">If Yes, GRN status moves to "Unloading Completed". Keep 'N' to continue building more pallets for this GRN.</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-bold text-lg w-full md:w-auto"
            >
              {isSubmitting ? "Generating..." : "Save Pallet Build"}
            </button>
          </div>
        </>)}

      </CardContent>
    </Card>

    {/* RIGHT PANEL - BUILT PALLETS */}
    {selectedGRN && (
      <Card className="w-full sticky top-4">
        <CardHeader className="border-b flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-lg">Built Pallets</CardTitle>
            <p className="text-xs text-muted-foreground">{selectedGRN.GRN_ID}</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={builtPallets.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs font-semibold"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingPallets ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading pallets...</div>
          ) : builtPallets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No pallets built yet for this GRN.</div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-3 border-b font-semibold text-xs uppercase tracking-wide">Pallet ID</th>
                    <th className="p-3 border-b font-semibold text-xs uppercase tracking-wide">SKU</th>
                    <th className="p-3 border-b font-semibold text-xs uppercase tracking-wide">Batch</th>
                    <th className="p-3 border-b font-semibold text-xs uppercase tracking-wide text-right">Qty (G/D)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {builtPallets.map((pallet, i) => (
                    <tr key={i} className="hover:bg-accent/50 transition-colors">
                      <td className="p-3 font-mono text-xs">{pallet.Pallet_ID}</td>
                      <td className="p-3">
                        <div className="font-semibold">{pallet.SKU_ID}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{pallet.SKU_Description}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{pallet.Batch_Number || "-"}</td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        <span className="text-green-700 font-medium">{pallet.Good_Box_Qty}</span> / <span className="text-red-600">{pallet.Damage_Box_Qty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    )}
    </div>
  );
}
