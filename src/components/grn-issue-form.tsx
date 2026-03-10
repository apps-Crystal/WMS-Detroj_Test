"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GRNData {
  GRN_ID: string;
  Status: string;
  Invoice_Quantity: number;
  Actual_Quantity: number;
}

export function GrnIssueForm() {
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<GRNData[]>([]);

  // Form State
  const [grnSearch, setGrnSearch] = useState("");
  const [showGrnDrop, setShowGrnDrop] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRNData | null>(null);
  const grnRef = useRef<HTMLDivElement>(null);

  const [invoiceQty, setInvoiceQty] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [remarks, setRemarks] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/grn-issue/data", { cache: "no-store" });
      const data = await res.json();
      if (data.status === "success" && data.grns) {
        setGrns(data.grns);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load GRNs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (grnRef.current && !grnRef.current.contains(e.target as Node)) setShowGrnDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filteredGRNs = grns.filter(g => !grnSearch || g.GRN_ID.toLowerCase().includes(grnSearch.toLowerCase()));

  const selectGRN = (g: GRNData) => {
    setSelectedGRN(g);
    setGrnSearch(g.GRN_ID);
    setInvoiceQty(String(g.Invoice_Quantity));
    setActualQty(String(g.Actual_Quantity));
    setShowGrnDrop(false);
    setRemarks("");
  };

  // Derive Shortage dynamically
  const parsedInvoice = parseFloat(invoiceQty) || 0;
  const parsedActual = parseFloat(actualQty) || 0;
  const shortage = parsedInvoice - parsedActual;

  const handleSubmit = async () => {
    if (!selectedGRN) return setErrorMsg("Please select a GRN.");
    if (!actualQty || parsedActual < 0) return setErrorMsg("Actual Quantity must be a valid number.");

    setIsSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const payload = {
        GRN_ID: selectedGRN.GRN_ID,
        Invoice_Quatity: String(parsedInvoice),
        Actual_Quantity: String(parsedActual),
        Shortage: String(shortage),
        Remarks: remarks,
        GRN_Issued: "Yes",
      };

      const res = await fetch("/api/grn-issue/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (d.status !== "success") throw new Error(d.message || "Submission failed");

      setSuccessMsg(`✅ GRN ${selectedGRN.GRN_ID} has been successfully issued!`);
      
      // Remove from list
      setGrns(prev => prev.filter(g => g.GRN_ID !== payload.GRN_ID));
      
      // Reset form
      setSelectedGRN(null);
      setGrnSearch("");
      setInvoiceQty("");
      setActualQty("");
      setRemarks("");

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-xl">05 GRN Issue</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading available GRNs..." : `${grns.length} GRNs available for Issue`}
        </p>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
        {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

        <div className="space-y-2">
          <Label className="text-blue-700 font-medium">GRN_ID <span className="text-red-500">*</span></Label>
          <div className="relative" ref={grnRef}>
            <Input
              placeholder="Search GRNs (Unloading/Putaway Completed)..."
              value={grnSearch}
              onChange={e => { setGrnSearch(e.target.value); setShowGrnDrop(true); setSelectedGRN(null); }}
              onFocus={() => setShowGrnDrop(true)}
              className="font-mono bg-white"
            />
            {showGrnDrop && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filteredGRNs.map(g => (
                  <button key={g.GRN_ID} type="button" onClick={() => selectGRN(g)}
                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0 font-mono text-sm leading-tight flex justify-between items-center">
                    <span>{g.GRN_ID}</span>
                    <span className="text-muted-foreground text-xs uppercase bg-muted px-2 py-0.5 rounded">{g.Status}</span>
                  </button>
                ))}
                {filteredGRNs.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No eligible GRNs found.</div>}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Only shows GRNs with Status &quot;Unloading Completed&quot; or &quot;Putaway Completed&quot;.</p>
        </div>

        {selectedGRN && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-6 space-y-6">
            <h3 className="font-semibold text-primary uppercase text-sm tracking-wide border-b border-primary/20 pb-2">Issue Details</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Total Invoice Qty</Label>
                <div className="relative">
                  <Input type="number" value={invoiceQty} readOnly className="bg-muted font-mono pr-12" />
                  <span className="absolute right-3 top-2 text-xs text-muted-foreground font-semibold">BOX</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Sys calculated from GRN Details</p>
              </div>

              <div className="space-y-2">
                <Label className="text-blue-700">Total Actual Qty <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input type="number" min="0" value={actualQty} onChange={e => setActualQty(e.target.value)} className="bg-white font-mono border-blue-400 pr-12 focus-visible:ring-blue-500" />
                  <span className="absolute right-3 top-2 text-xs text-muted-foreground font-semibold">BOX</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Sys calculated from Pallet Build (Editable)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label>Calculated Shortage</Label>
                <Input value={shortage} readOnly className={`font-mono font-bold ${shortage > 0 ? "bg-red-50 text-red-600 border-red-200" : shortage < 0 ? "bg-green-50 text-green-600 border-green-200" : "bg-muted text-muted-foreground"}`} />
                <p className="text-[10px] text-muted-foreground">Invoice Qty - Actual Qty</p>
              </div>

              <div className="space-y-2">
                 <Label>Remarks</Label>
                 <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="bg-white" placeholder="Add shortage reasons or notes..." />
              </div>
            </div>
            
             <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-bold text-lg shadow-sm"
              >
                {isSubmitting ? "Processing..." : "Issue GRN"}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
