"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp, convertInputDate } from "@/lib/dateUtils";
import { ScanBarcode, Download, Plus, Trash2, Camera } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

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

interface BuiltPalletItem {
  Pallet_ID: string;
  Pallet_GRN: string;
  Total_Received_Qty_Boxes: string;
  Damage_Box_Qty: string;
  Good_Box_Qty: string;
  Photos_URL: string;
  Remarks: string;
}

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

function ScannerModal({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render(
      (text) => {
        scanner.clear();
        onScan(text);
      },
      () => {}
    );
    return () => {
      try {
        scanner.clear();
      } catch (e) {}
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-md p-4 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-center mb-4">Scan Pallet Barcode</h3>
        <div id="reader" className="w-full"></div>
        <button type="button" onClick={onClose} className="mt-4 w-full py-2 bg-red-100 font-semibold text-red-600 rounded">
          Close Scanner
        </button>
      </div>
    </div>
  );
}

export function MultiplePalletBuildForm() {
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<PendingGRN[]>([]);
  const [availablePallets, setAvailablePallets] = useState<string[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  
  const [builtPallets, setBuiltPallets] = useState<BuiltPallet[]>([]);
  const [loadingPallets, setLoadingPallets] = useState(false);

  // Step 1 State: GRN
  const [selectedGRN, setSelectedGRN] = useState<PendingGRN | null>(null);
  const [grnSearch, setGrnSearch] = useState("");
  const [showGrnDrop, setShowGrnDrop] = useState(false);
  const grnRef = useRef<HTMLDivElement>(null);

  // Step 2 State: SKU & Common Details
  const [skuSearch, setSkuSearch] = useState("");
  const [showSkuDrop, setShowSkuDrop] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(null);
  const skuRef = useRef<HTMLDivElement>(null);

  const [batchNo, setBatchNo] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [wrapping, setWrapping] = useState("");
  const [builtBy, setBuiltBy] = useState("");

  // Step 3 State: Sub-form for Individual Pallets
  const [addedPallets, setAddedPallets] = useState<BuiltPalletItem[]>([]);
  
  const [palletSearch, setPalletSearch] = useState("");
  const [showPalletDrop, setShowPalletDrop] = useState(false);
  const palletRef = useRef<HTMLDivElement>(null);
  
  const [showScanner, setShowScanner] = useState(false);

  const [currentTotalBox, setCurrentTotalBox] = useState("");
  const [currentDamageBox, setCurrentDamageBox] = useState("");
  const [currentPhotoFile, setCurrentPhotoFile] = useState<File | null>(null);
  const [currentRemarks, setCurrentRemarks] = useState("");

  // Final Form State
  const [vehicleCompleted, setVehicleCompleted] = useState("N");
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
        if (palletData.pallets) setAvailablePallets(palletData.pallets);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGRN) {
      setSkus([]);
      return;
    }
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

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (grnRef.current && !grnRef.current.contains(e.target as Node)) setShowGrnDrop(false);
      if (palletRef.current && !palletRef.current.contains(e.target as Node)) setShowPalletDrop(false);
      if (skuRef.current && !skuRef.current.contains(e.target as Node)) setShowSkuDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Filtering
  const filteredGRNs = grns.filter(g =>
    g.GRN_ID.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Vehicle_Number?.toLowerCase().includes(grnSearch.toLowerCase())
  );
  
  const filteredPallets = availablePallets.filter(p => 
    (!palletSearch || p.toLowerCase().includes(palletSearch.toLowerCase())) &&
    !addedPallets.some(a => a.Pallet_ID === p) // Hide already added pallets
  );
  
  const filteredSKUs = skus.filter(s => 
    s.sku_id.toLowerCase().includes(skuSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const selectGRN = (grn: PendingGRN) => { 
    setSelectedGRN(grn); setGrnSearch(grn.GRN_ID); setShowGrnDrop(false);
    setSkuSearch(""); setSelectedSKU(null); setAddedPallets([]); setBuiltPallets([]);
  };
  const selectPallet = (p: string) => { setPalletSearch(p); setShowPalletDrop(false); };
  const selectSKU = (sku: SKU) => { setSelectedSKU(sku); setSkuSearch(sku.sku_id); setShowSkuDrop(false); };

  const PALLET_FOLDER_ID = "1KV9b9RAVZIZAaUJopuTUIDdgukt7Xffw";

  const uploadPhoto = async (file: File | null): Promise<string> => {
    if (!file) return "";
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folderId", PALLET_FOLDER_ID);
      const res = await fetch("/api/upload-file", { method: "POST", body: fd });
      if (!res.ok) return "";
      const d = await res.json();
      return d.url || "";
    } catch { return ""; }
  };

  const handleAddPallet = async () => {
    if (!selectedGRN) return;
    if (!palletSearch) { setErrorMsg("Please scan or select a Pallet ID."); return; }
    if (!currentTotalBox || parseFloat(currentTotalBox) <= 0) { setErrorMsg("Total boxes must be > 0."); return; }

    setErrorMsg("");
    
    // Calculate Good Boxes
    const tot = parseFloat(currentTotalBox) || 0;
    const dam = parseFloat(currentDamageBox) || 0;
    const good = tot - dam >= 0 ? tot - dam : 0;
    
    const pGRN = `${selectedGRN.GRN_ID}-${palletSearch}`;

    // Upload photo now so it's ready in the list
    let photoUrl = "";
    if (currentPhotoFile) {
      photoUrl = await uploadPhoto(currentPhotoFile);
    }

    const newItem: BuiltPalletItem = {
      Pallet_ID: palletSearch,
      Pallet_GRN: pGRN,
      Total_Received_Qty_Boxes: String(tot),
      Damage_Box_Qty: String(dam),
      Good_Box_Qty: String(good),
      Photos_URL: photoUrl,
      Remarks: currentRemarks,
    };

    setAddedPallets([...addedPallets, newItem]);

    // Reset current sub-form
    setPalletSearch("");
    setCurrentTotalBox("");
    setCurrentDamageBox("");
    setCurrentPhotoFile(null);
    setCurrentRemarks("");
  };

  const removePallet = (idx: number) => {
    setAddedPallets(addedPallets.filter((_, i) => i !== idx));
  };

  const handleSubmitAll = async () => {
    if (!selectedGRN) { setErrorMsg("Please select a GRN."); return; }
    if (!selectedSKU) { setErrorMsg("Please select an SKU."); return; }
    if (addedPallets.length === 0) { setErrorMsg("Please add at least one pallet."); return; }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const ts = formatTimestamp();
      
      const payloadPallets = addedPallets.map(p => ({
        GRN_ID: selectedGRN.GRN_ID,
        Vehicle_Number: selectedGRN.Vehicle_Number,
        Pallet_ID: p.Pallet_ID,
        Pallet_GRN: p.Pallet_GRN,
        Timestamp: ts,
        Built_By: builtBy,
        SKU_ID: selectedSKU.sku_id,
        SKU_Description: selectedSKU.description,
        Batch_Number: batchNo,
        Manufacturing_Date: convertInputDate(mfgDate),
        Expiry_Date: convertInputDate(expDate),
        Good_Box_Qty: p.Good_Box_Qty,
        Damage_Box_Qty: p.Damage_Box_Qty,
        Total_Received_Qty_Boxes: p.Total_Received_Qty_Boxes,
        Wrapping: wrapping,
        Photos_URL: p.Photos_URL,
        Remarks: p.Remarks,
      }));

      const res = await fetch("/api/pallet-build/submit-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          GRN_ID: selectedGRN.GRN_ID, // Provide for status update
          Vehicle_Completed: vehicleCompleted === "Y",
          pallets: payloadPallets
        }),
      });
      const result = await res.json();
      if (result.status !== "success") throw new Error(result.message || "Submission failed");

      setSuccessMsg(`✅ Built ${addedPallets.length} pallets successfully!`);
      
      const currentGrnId = selectedGRN.GRN_ID;

      if (vehicleCompleted === "Y") {
        setGrns(prev => prev.filter(g => g.GRN_ID !== currentGrnId));
        setSelectedGRN(null);
        setGrnSearch("");
      } else {
        fetchBuiltPallets(currentGrnId);
      }
      
      // Remove used pallets from pool
      const usedIds = addedPallets.map(p => p.Pallet_ID);
      setAvailablePallets(prev => prev.filter(p => !usedIds.includes(p)));

      // Reset
      setAddedPallets([]);
      setPalletSearch(""); setSkuSearch(""); setSelectedSKU(null);
      setBatchNo(""); setMfgDate(""); setExpDate(""); setWrapping("");
      setVehicleCompleted("N");
      
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
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_600px] gap-6 items-start">
      <Card className="w-full shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-xl">03 Pallet Build - MULTIPLE PALLETS</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `Assign multiple pallets to a single SKU from the same GRN.`}
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
                  onClick={() => { setSelectedGRN(null); setGrnSearch(""); setSkus([]); setAddedPallets([]); }}
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
            </div>
          </div>

          {selectedGRN && (<>
            {/* COMMON SKU SECTION */}
            <div className="p-4 rounded-md border-2 border-primary/20 bg-primary/5 space-y-4">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wide border-b border-primary/20 pb-2">Common SKU Details</h3>
              
              <div className="grid grid-cols-[1fr_2fr] gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-blue-700">SKU_ID <span className="text-red-500">*</span></Label>
                  <div className="relative" ref={skuRef}>
                    <Input
                      placeholder="Search SKU..."
                      value={skuSearch}
                      onChange={e => { setSkuSearch(e.target.value); setShowSkuDrop(true); setSelectedSKU(null); }}
                      onFocus={() => setShowSkuDrop(true)}
                      className="font-mono bg-white"
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
                  <Label>SKU_Description</Label>
                  <Input value={selectedSKU?.description || ""} readOnly className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Batch_Number</Label>
                  <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Manufacturing_Date</Label>
                  <Input type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label>Expiry_Date</Label>
                  <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="bg-white" />
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
            </div>

            {/* ADD PALLETS SECTION */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b pb-2 flex justify-between items-end">
                <span>FOR MULTIPLE PALLETS</span>
                <span className="text-sm font-normal text-muted-foreground">{addedPallets.length} added</span>
              </h3>

              {/* Sub-form to add a pallet */}
              <div className="p-4 border rounded-md shadow-sm bg-background grid grid-cols-[1fr_1fr_1fr_2fr] gap-4 items-end">
                <div className="space-y-2 col-span-4 md:col-span-1">
                  <Label className="font-semibold text-blue-700 flex justify-between">
                    <span>Pallet_ID *</span>
                    <button type="button" onClick={() => setShowScanner(true)} className="text-blue-600 hover:text-blue-800" title="Scan Barcode">
                      <Camera className="w-4 h-4" />
                    </button>
                  </Label>
                  <div className="relative" ref={palletRef}>
                    <Input
                      placeholder="Pallet ID"
                      value={palletSearch}
                      onChange={e => { setPalletSearch(e.target.value); setShowPalletDrop(true); }}
                      onFocus={() => setShowPalletDrop(true)}
                      className="font-mono bg-white"
                    />
                    {showPalletDrop && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                        {filteredPallets.slice(0, 30).map(p => (
                          <button key={p} type="button" onClick={() => selectPallet(p)}
                            className="w-full px-4 py-2 text-left hover:bg-accent border-b last:border-0 font-mono text-sm leading-tight">
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-blue-700">Total Qty *</Label>
                  <Input type="number" min="0" value={currentTotalBox} onChange={e => setCurrentTotalBox(e.target.value)} placeholder="Total" className="bg-white" />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-red-600">Damage</Label>
                  <Input type="number" min="0" value={currentDamageBox} onChange={e => setCurrentDamageBox(e.target.value)} placeholder="Damage" className="bg-white" />
                </div>
                
                <div className="space-y-2 col-span-4 md:col-span-1 flex flex-col items-end w-full h-full justify-between">
                   <div className="flex gap-2 w-full">
                    <label className="flex-1 shrink-0 flex items-center justify-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted bg-white text-sm text-muted-foreground truncate">
                      📷 {currentPhotoFile ? <span className="text-green-600">Got</span> : "Photo"}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setCurrentPhotoFile(e.target.files?.[0] || null)} />
                    </label>
                    <button type="button" onClick={handleAddPallet} className="flex-[2] py-2 bg-indigo-600 text-white rounded-md font-semibold flex items-center justify-center gap-1 hover:bg-indigo-700">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 col-span-4">
                  <Input value={currentRemarks} onChange={e => setCurrentRemarks(e.target.value)} placeholder="Remarks for this pallet (optional)" className="bg-white" />
                </div>
              </div>

              {/* Added Pallets List */}
              {addedPallets.length > 0 && (
                <div className="border rounded-md overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left bg-white">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 border-b">Pallet_ID</th>
                        <th className="px-4 py-3 border-b text-right">Qty (Good/Total)</th>
                        <th className="px-4 py-3 border-b">Has Photo</th>
                        <th className="px-4 py-3 border-b text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {addedPallets.map((ap, idx) => (
                        <tr key={idx} className="hover:bg-accent/30">
                          <td className="px-4 py-3 font-mono font-medium text-xs text-blue-800">{ap.Pallet_ID}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-green-700">{ap.Good_Box_Qty}</span> / {ap.Total_Received_Qty_Boxes}
                          </td>
                          <td className="px-4 py-3 text-xs">
                             {ap.Photos_URL ? "✅" : "❌"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => removePallet(idx)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t my-4" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <Label className="font-semibold text-lg text-red-600">Vehicle_Completed?</Label>
                <ToggleGroup
                  options={["N", "Y"]}
                  value={vehicleCompleted}
                  onChange={setVehicleCompleted}
                  colorMap={{ "N": "bg-primary text-primary-foreground", "Y": "bg-red-600 text-white" }}
                />
                <p className="text-xs text-muted-foreground max-w-sm mt-1">If Yes, GRN status moves to &quot;Unloading Completed&quot;. Keep &apos;N&apos; to continue building more pallets.</p>
              </div>

              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={isSubmitting || addedPallets.length === 0}
                className="px-10 py-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-bold text-lg w-full md:w-auto shadow-lg"
              >
                {isSubmitting ? "Generating All..." : `Submit All (${addedPallets.length} Pallets)`}
              </button>
            </div>
          </>)}

        </CardContent>
      </Card>

      {/* RIGHT PANEL - BUILT PALLETS */}
      {selectedGRN && (
        <Card className="w-full sticky top-4 shadow-sm">
          <CardHeader className="border-b flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">Built Pallets</CardTitle>
              <p className="text-xs text-muted-foreground">{selectedGRN.GRN_ID}</p>
            </div>
            <button
              onClick={exportCSV}
              disabled={builtPallets.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs font-semibold shadow-sm"
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
              <div className="max-h-[800px] overflow-auto">
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
      
      {showScanner && (
        <ScannerModal 
          onScan={(text) => { setPalletSearch(text); setShowScanner(false); }} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </>
  );
}
