"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp } from "@/lib/dateUtils";

interface SKU {
  sku_id: string;
  description: string;
}

interface DNLine {
  id: string; // local key
  SKU_ID: string;
  SKU_Description: string;
  Order_Quantity: string;
}

export function DnEntryForm() {
  const { data: session } = useSession();

  // Header state
  const [dnId, setDnId] = useState("Generating...");
  const [customerName, setCustomerName] = useState("");
  const [customers, setCustomers] = useState<string[]>([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custSearch, setCustSearch] = useState("");
  const custRef = useRef<HTMLDivElement>(null);

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [orderUploadUrl, setOrderUploadUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createdBy, setCreatedBy] = useState("");

  // Lines state
  const [lines, setLines] = useState<DNLine[]>([{ id: "1", SKU_ID: "", SKU_Description: "", Order_Quantity: "" }]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [skuSearch, setSkuSearch] = useState<Record<string, string>>({});
  const skuDropRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const UPLOAD_API = "/api/upload-file";

  useEffect(() => {
    if (session?.user?.email) setCreatedBy(session.user.email);
  }, [session]);

  const fetchInit = useCallback(async () => {
    try {
      const [idRes, skuRes, custRes] = await Promise.all([
        fetch("/api/dn-entry/generate-id").then(r => r.json()),
        fetch(`/api/skus`).then(r => r.json()),
        fetch(`/api/customers`).then(r => r.json()),
      ]);
      if (idRes.nextId) setDnId(idRes.nextId);
      if (skuRes.skus) setSkus(skuRes.skus);
      if (custRes.customers) setCustomers(custRes.customers);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchInit(); }, [fetchInit]);

  // Close dropdowns on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false);
      if (skuDropRef.current && !skuDropRef.current.contains(e.target as Node)) setActiveLine(null);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const totalQty = lines.reduce((s, l) => s + (parseFloat(l.Order_Quantity) || 0), 0);

  const addLine = () => {
    setLines(prev => [...prev, { id: String(Date.now()), SKU_ID: "", SKU_Description: "", Order_Quantity: "" }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof DNLine, value: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const selectSku = (lineId: string, sku: SKU) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, SKU_ID: sku.sku_id, SKU_Description: sku.description } : l));
    setSkuSearch(prev => ({ ...prev, [lineId]: sku.sku_id }));
    setActiveLine(null);
  };

  // File upload to Drive via Apps Script
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const toBase64 = (f: File) => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      const base64 = await toBase64(file);
      const resp = await fetch(UPLOAD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data: base64,
          mimeType: file.type,
          fileName: file.name,
        }),
        redirect: "follow",
      });
      const d = await resp.json();
      if (d.url) setOrderUploadUrl(d.url);
    } catch (err: any) {
      setErrorMsg("File upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!customerName) return setErrorMsg("Please select a Customer.");
    const invalidLine = lines.find(l => !l.SKU_ID || !l.Order_Quantity);
    if (invalidLine) return setErrorMsg("All lines must have a SKU and Order Quantity.");

    setIsSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const now = formatTimestamp();
      const payload = {
        DN_ID: dnId,
        Customer_Name: customerName,
        Order_Time: now,
        Order_Date: orderDate,
        Order_Upload: orderUploadUrl,
        Created_By_Email: createdBy,
        lines: lines.map((l, idx) => ({
          Line_No: `${dnId}-Line-${idx + 1}`,
          SKU_ID: l.SKU_ID,
          SKU_Description: l.SKU_Description,
          Order_Quantity: parseFloat(l.Order_Quantity) || 0,
        })),
      };

      const res = await fetch("/api/dn-entry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.status !== "success") throw new Error(d.message || "Submission failed");

      setSuccessMsg(`✅ DN ${dnId} created with ${lines.length} line(s) — Status: Order Created`);

      // Reset
      setLines([{ id: "1", SKU_ID: "", SKU_Description: "", Order_Quantity: "" }]);
      setSkuSearch({});
      setCustomerName(""); setCustSearch("");
      setOrderUploadUrl("");
      setDnId("Generating...");
      fetch("/api/dn-entry/generate-id").then(r => r.json()).then(d => d.nextId && setDnId(d.nextId));

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => !custSearch || c.toLowerCase().includes(custSearch.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">01 DN Entry — OB</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Create a new Delivery Note with multiple SKU lines</p>
            </div>
            <span className="font-mono text-2xl font-bold text-primary">{dnId}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
          {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer */}
            <div className="space-y-2">
              <Label className="text-blue-700 font-medium">Customer_Name <span className="text-red-500">*</span></Label>
              <div className="relative" ref={custRef}>
                <Input
                  placeholder="Search customer..."
                  value={custSearch || customerName}
                  onChange={e => { setCustSearch(e.target.value); setShowCustDrop(true); setCustomerName(""); }}
                  onFocus={() => setShowCustDrop(true)}
                  className="bg-white"
                />
                {showCustDrop && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredCustomers.map(c => (
                      <button key={c} type="button"
                        onClick={() => { setCustomerName(c); setCustSearch(""); setShowCustDrop(false); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-accent border-b last:border-0 text-sm">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Order Date */}
            <div className="space-y-2">
              <Label>Order_Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="bg-white" />
            </div>

            {/* Order Upload */}
            <div className="space-y-2">
              <Label>Order_Upload (PDF/Image)</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 border-2 border-dashed rounded-md p-3 cursor-pointer hover:border-primary transition-colors bg-muted/20">
                <span className="text-2xl">📄</span>
                <div className="flex-1 min-w-0">
                  {uploading ? (
                    <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>
                  ) : orderUploadUrl ? (
                    <a href={orderUploadUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline truncate block" onClick={e => e.stopPropagation()}>
                      View Uploaded File ↗
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to upload order document</span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
              </div>
            </div>

            {/* Created By */}
            <div className="space-y-2">
              <Label>Created_By_Email</Label>
              <Input value={createdBy} readOnly className="bg-muted font-mono text-sm" />
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-3 py-2">
            <Label>Status</Label>
            <span className="bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-sm font-semibold">Order Created</span>
            <span className="ml-auto text-sm text-muted-foreground font-medium">
              Total Qty: <span className="text-foreground font-bold">{totalQty}</span>
            </span>
          </div>

          <div className="border-t" />

          {/* SKU Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Order Lines — DN_Detail_OB_02</h3>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium">
                + Add Line
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/40 rounded-md text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-1">#</div>
              <div className="col-span-4">SKU_ID</div>
              <div className="col-span-4">SKU_Description</div>
              <div className="col-span-2">Order_Qty</div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-2" ref={skuDropRef}>
              {lines.map((line, idx) => {
                const filtered = skus.filter(s =>
                  !skuSearch[line.id] || s.sku_id.toLowerCase().includes(skuSearch[line.id].toLowerCase()) || s.description.toLowerCase().includes(skuSearch[line.id].toLowerCase())
                );
                return (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-start border rounded-md p-3 bg-white hover:border-primary/30 transition-colors">
                    <div className="col-span-1 pt-2 text-sm text-muted-foreground font-mono">{idx + 1}</div>

                    {/* SKU ID searchable dropdown */}
                    <div className="col-span-4 relative">
                      <Input
                        placeholder="Search SKU..."
                        value={activeLine === line.id ? (skuSearch[line.id] ?? line.SKU_ID) : line.SKU_ID}
                        onChange={e => {
                          setSkuSearch(prev => ({ ...prev, [line.id]: e.target.value }));
                          setActiveLine(line.id);
                          updateLine(line.id, "SKU_ID", e.target.value);
                        }}
                        onFocus={() => { setActiveLine(line.id); setSkuSearch(prev => ({ ...prev, [line.id]: "" })); }}
                        className="bg-white font-mono text-sm"
                      />
                      {activeLine === line.id && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-44 overflow-auto">
                          {filtered.slice(0, 30).map(s => (
                            <button key={s.sku_id} type="button"
                              onClick={() => selectSku(line.id, s)}
                              className="w-full px-3 py-2 text-left hover:bg-accent border-b last:border-0 text-sm leading-tight">
                              <span className="font-mono">{s.sku_id}</span>
                              <span className="text-muted-foreground text-xs ml-2">{s.description}</span>
                            </button>
                          ))}
                          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No SKU found</div>}
                        </div>
                      )}
                    </div>

                    {/* SKU Description */}
                    <div className="col-span-4">
                      <Input value={line.SKU_Description} readOnly className="bg-muted text-sm" placeholder="Auto-filled" />
                    </div>

                    {/* Order Qty */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={line.Order_Quantity}
                        onChange={e => updateLine(line.id, "Order_Quantity", e.target.value)}
                        className="bg-white font-mono text-sm"
                      />
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 flex justify-center pt-1">
                      <button type="button" onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                        className="text-destructive hover:text-destructive/70 disabled:opacity-30 text-lg font-bold">
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lines summary */}
            <div className="flex justify-end">
              <div className="bg-muted/30 border rounded-md px-6 py-3 text-right">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Order Qty</div>
                <div className="text-2xl font-bold font-mono">{totalQty}</div>
              </div>
            </div>
          </div>

          <div className="border-t pt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-bold text-base shadow-sm">
              {isSubmitting ? "Saving..." : "Save DN Entry"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
