"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GRNRecord {
  GRN_ID: string;
  Arrival_Time: string;
  Vehicle_Number: string;
  Driver_Name: string;
  Customer_Name: string;
  Invoice_Number: string;
  Invoice_Date: string;
  Invoice_URL: string;
  LR_Number: string;
  LR_Photo: string;
  Seal_Intact: string;
  Temp_Display_C: string;
  Created_By_Email: string;
}

interface SKU {
  sku_id: string;
  description: string;
}

interface SKULine {
  id: number;
  SKU_ID: string;
  SKU_Description: string;
  Invoice_Quantity: string;
  skuSearch: string;
  showDropdown: boolean;
}

export function GrnEntryForm() {
  const { data: session } = useSession();

  const [pendingGRNs, setPendingGRNs] = useState<GRNRecord[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [selectedGRN, setSelectedGRN] = useState<GRNRecord | null>(null);
  const [grnSearch, setGrnSearch] = useState("");
  const [showGrnDropdown, setShowGrnDropdown] = useState(false);

  const [lines, setLines] = useState<SKULine[]>([
    { id: 1, SKU_ID: "", SKU_Description: "", Invoice_Quantity: "", skuSearch: "", showDropdown: false }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const grnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pendingRes, skuRes] = await Promise.all([
          fetch("/api/grn-entry/pending", { cache: "no-store" }),
          fetch("/api/skus", { cache: "no-store" }),
        ]);
        const pendingData = await pendingRes.json();
        const skuData = await skuRes.json();
        if (pendingData.pending) setPendingGRNs(pendingData.pending);
        if (skuData.skus) setSkus(skuData.skus);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Close GRN dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (grnRef.current && !grnRef.current.contains(e.target as Node)) {
        setShowGrnDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredGRNs = pendingGRNs.filter(g =>
    g.GRN_ID.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Customer_Name?.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Vehicle_Number?.toLowerCase().includes(grnSearch.toLowerCase())
  );

  const selectGRN = (grn: GRNRecord) => {
    setSelectedGRN(grn);
    setGrnSearch(grn.GRN_ID);
    setShowGrnDropdown(false);
  };

  // SKU line management
  const addLine = () => {
    setLines(prev => [...prev, {
      id: prev.length + 1,
      SKU_ID: "", SKU_Description: "", Invoice_Quantity: "",
      skuSearch: "", showDropdown: false
    }]);
  };

  const removeLine = (id: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: number, field: keyof SKULine, value: string | boolean) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const selectSKU = (lineId: number, sku: SKU) => {
    setLines(prev => prev.map(l => l.id === lineId
      ? { ...l, SKU_ID: sku.sku_id, SKU_Description: sku.description, skuSearch: sku.sku_id, showDropdown: false }
      : l
    ));
  };

  const getLineNo = (grnId: string, index: number) => `${grnId}-${index + 1}`;

  const handleSubmit = async () => {
    if (!selectedGRN) { setErrorMsg("Please select a GRN ID."); return; }
    const emptyLine = lines.find(l => !l.SKU_ID || !l.Invoice_Quantity);
    if (emptyLine) { setErrorMsg("Please fill SKU ID and Invoice Quantity for all lines."); return; }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        ...selectedGRN,
        Created_By_Email: session?.user?.email || selectedGRN.Created_By_Email,
        lines: lines.map((l, i) => ({
          Line_No: getLineNo(selectedGRN.GRN_ID, i),
          SKU_ID: l.SKU_ID,
          SKU_Description: l.SKU_Description,
          Invoice_Quantity: l.Invoice_Quantity,
        })),
      };

      const res = await fetch("/api/grn-entry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.status !== "success") throw new Error(result.message || "Submission failed");

      setSuccessMsg(`GRN Entry saved! Status set to "Vehicle Arrived". GRN: ${selectedGRN.GRN_ID}`);
      // Remove submitted GRN from pending list
      setPendingGRNs(prev => prev.filter(g => g.GRN_ID !== selectedGRN.GRN_ID));
      setSelectedGRN(null);
      setGrnSearch("");
      setLines([{ id: 1, SKU_ID: "", SKU_Description: "", Invoice_Quantity: "", skuSearch: "", showDropdown: false }]);
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

  if (loading) {
    return (
      <Card className="w-full max-w-5xl mx-auto">
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading pending GRNs and SKU master...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Invoice Entry / GRN Entry - IB</CardTitle>
        <p className="text-sm text-muted-foreground">
          {pendingGRNs.length} pending GRN{pendingGRNs.length !== 1 ? "s" : ""} awaiting invoice entry
        </p>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">
        {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm">{successMsg}</div>}
        {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

        {/* GRN ID Searchable Dropdown */}
        <div className="space-y-2">
          <Label className="font-semibold">Select GRN ID <span className="text-red-500">*</span></Label>
          <div className="relative" ref={grnRef}>
            <Input
              placeholder="Search GRN ID, Customer or Vehicle..."
              value={grnSearch}
              onChange={e => { setGrnSearch(e.target.value); setShowGrnDropdown(true); setSelectedGRN(null); }}
              onFocus={() => setShowGrnDropdown(true)}
              className="font-mono"
            />
            {showGrnDropdown && filteredGRNs.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
                {filteredGRNs.map(grn => (
                  <button
                    key={grn.GRN_ID}
                    type="button"
                    onClick={() => selectGRN(grn)}
                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0"
                  >
                    <div className="font-mono font-semibold text-sm">{grn.GRN_ID}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {grn.Customer_Name} · {grn.Vehicle_Number} · {grn.Arrival_Time}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showGrnDropdown && grnSearch && filteredGRNs.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-sm px-4 py-3 text-sm text-muted-foreground">
                No pending GRNs found
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Details (auto-filled, read-only) */}
        {selectedGRN && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2">Vehicle Details (Auto-filled)</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ReadOnlyField label="Arrival Time" value={selectedGRN.Arrival_Time} />
              <ReadOnlyField label="Vehicle Number" value={selectedGRN.Vehicle_Number} />
              <ReadOnlyField label="Driver Name" value={selectedGRN.Driver_Name} />
              <ReadOnlyField label="Customer Name" value={selectedGRN.Customer_Name} />
              <ReadOnlyField label="Invoice Number" value={selectedGRN.Invoice_Number} />
              <ReadOnlyField label="Invoice Date" value={selectedGRN.Invoice_Date} />
              <ReadOnlyField label="LR Number" value={selectedGRN.LR_Number} />
              <ReadOnlyField label="Seal Intact" value={selectedGRN.Seal_Intact} />
              <ReadOnlyField label="Temp Display (C)" value={selectedGRN.Temp_Display_C} />
            </div>
            {selectedGRN.Invoice_URL && (
              <a href={selectedGRN.Invoice_URL} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline">📄 View Invoice File</a>
            )}
            {selectedGRN.LR_Photo && (
              <a href={selectedGRN.LR_Photo} target="_blank" rel="noopener noreferrer"
                className="ml-4 text-sm text-blue-600 hover:underline">📷 View LR Photo</a>
            )}
          </div>
        )}

        {/* SKU Lines */}
        {selectedGRN && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-px w-8 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">SKU Lines</span>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
              >
                + Add SKU Line
              </button>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide w-12">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide w-52">Line No</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide min-w-[220px]">SKU ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide min-w-[280px]">SKU Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide w-36">Invoice Qty</th>
                    <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide w-16">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const filteredSKUs = skus.filter(s =>
                      s.sku_id.toLowerCase().includes(line.skuSearch.toLowerCase()) ||
                      s.description.toLowerCase().includes(line.skuSearch.toLowerCase())
                    );
                    return (
                      <tr key={line.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 text-center text-muted-foreground font-mono font-semibold">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {getLineNo(selectedGRN.GRN_ID, idx)}
                        </td>
                        {/* SKU Searchable Dropdown */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <Input
                              placeholder="Search SKU ID..."
                              value={line.skuSearch}
                              onChange={e => {
                                updateLine(line.id, "skuSearch", e.target.value);
                                updateLine(line.id, "SKU_ID", "");
                                updateLine(line.id, "showDropdown", true as any);
                              }}
                              onFocus={() => updateLine(line.id, "showDropdown", true as any)}
                              className="h-10 text-sm"
                            />
                            {line.showDropdown && filteredSKUs.length > 0 && (
                              <div className="absolute z-50 left-0 mt-1 w-80 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                                {filteredSKUs.slice(0, 20).map(sku => (
                                  <button
                                    key={sku.sku_id}
                                    type="button"
                                    onMouseDown={() => selectSKU(line.id, sku)}
                                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0"
                                  >
                                    <div className="font-mono text-sm font-semibold">{sku.sku_id}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sku.description}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* SKU Description (auto-filled) */}
                        <td className="px-4 py-3">
                          <div className="h-10 px-3 py-2 rounded border bg-muted text-sm flex items-center text-muted-foreground">
                            {line.SKU_Description || <span className="italic text-xs">Auto-filled on SKU select</span>}
                          </div>
                        </td>
                        {/* Invoice Quantity */}
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            placeholder="Qty"
                            value={line.Invoice_Quantity}
                            onChange={e => updateLine(line.id, "Invoice_Quantity", e.target.value)}
                            className="h-10 text-sm"
                          />
                        </td>
                        {/* Delete */}
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            disabled={lines.length === 1}
                            className="text-red-400 hover:text-red-600 disabled:opacity-30 text-2xl leading-none font-light"
                            title="Remove line"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-muted-foreground">
                Status will be set to <span className="font-semibold text-green-700">Vehicle Arrived</span> on submission
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-semibold"
              >
                {isSubmitting ? "Saving..." : "Submit GRN Entry"}
              </button>
            </div>
          </div>
        )}

        {!selectedGRN && !loading && pendingGRNs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold">All GRNs have been processed!</p>
            <p className="text-sm mt-1">No pending vehicle entries awaiting invoice entry.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
