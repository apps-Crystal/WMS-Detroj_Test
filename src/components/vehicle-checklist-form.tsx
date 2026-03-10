"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp } from "@/lib/dateUtils";


interface ArrivedGRN {
  GRN_ID: string;
  Vehicle_Number: string;
  Driver_Name: string;
  Customer_Name: string;
  Temp_Display_C: string;
}

const DOCK_OPTIONS: string[] = []; // now loaded from sheet

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

export function VehicleChecklistForm() {
  const { data: session } = useSession();
  const [arrivedGRNs, setArrivedGRNs] = useState<ArrivedGRN[]>([]);
  const [docks, setDocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [grnSearch, setGrnSearch] = useState("");
  const [showGrnDrop, setShowGrnDrop] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<ArrivedGRN | null>(null);
  const grnRef = useRef<HTMLDivElement>(null);

  // Form state
  const [dockNo, setDockNo] = useState("");
  const [tempAtGate, setTempAtGate] = useState("");
  const [cleanliness, setCleanliness] = useState("");
  const [foulSmell, setFoulSmell] = useState("");
  const [properArrangement, setProperArrangement] = useState("");
  const [damageDesc, setDamageDesc] = useState("");
  const [status, setStatus] = useState("");
  const [photosUrl, setPhotosUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [supervisorName, setSupervisorName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (session?.user?.name) setSupervisorName(session.user.name);
    else if (session?.user?.email) setSupervisorName(session.user.email);
  }, [session]);

  useEffect(() => {
    Promise.all([
      fetch("/api/vehicle-checklist/arrived", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/docks", { cache: "no-store" }).then(r => r.json()),
    ])
      .then(([arrivedData, docksData]) => {
        if (arrivedData.grns) setArrivedGRNs(arrivedData.grns);
        if (docksData.docks) setDocks(docksData.docks);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (grnRef.current && !grnRef.current.contains(e.target as Node)) setShowGrnDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const filtered = arrivedGRNs.filter(g =>
    g.GRN_ID.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Vehicle_Number?.toLowerCase().includes(grnSearch.toLowerCase()) ||
    g.Customer_Name?.toLowerCase().includes(grnSearch.toLowerCase())
  );

  const selectGRN = (grn: ArrivedGRN) => {
    setSelectedGRN(grn);
    setGrnSearch(grn.GRN_ID);
    setTempAtGate(grn.Temp_Display_C || "");
    setShowGrnDrop(false);
  };

  const CHECKLIST_FOLDER_ID = "1FMwzL4cTbcB6bOk7FuIxmDmLjqgcmcjf";

  const uploadPhoto = async (): Promise<string> => {
    if (!photoFile) return "";
    try {
      const fd = new FormData();
      fd.append("file", photoFile);
      fd.append("folderId", CHECKLIST_FOLDER_ID); // Upload to checklist-specific folder
      const res = await fetch("/api/upload-file", { method: "POST", body: fd });
      if (!res.ok) return "";
      const d = await res.json();
      return d.url || "";
    } catch { return ""; }
  };

  const handleSubmit = async () => {
    if (!selectedGRN) { setErrorMsg("Please select a GRN."); return; }
    if (!dockNo) { setErrorMsg("Please select a Dock Number."); return; }
    if (!cleanliness) { setErrorMsg("Please select Cleanliness."); return; }
    if (!foulSmell) { setErrorMsg("Please select Foul Smell."); return; }
    if (!properArrangement) { setErrorMsg("Please select Proper Arrangement."); return; }
    if (!status) { setErrorMsg("Please select Status."); return; }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const url = await uploadPhoto();
      const payload = {
        GRN_ID: selectedGRN.GRN_ID,
        Checklist_GRN_ID: `Checklist-${selectedGRN.GRN_ID}`,
        Vehicle_Number: selectedGRN.Vehicle_Number,
        Timestamp: formatTimestamp(),
        Supervisor_Name: supervisorName,
        Temperature_at_Gate: tempAtGate,
        Cleanliness: cleanliness,
        Foul_Smell: foulSmell,
        Proper_Arrangement: properArrangement,
        Damage_Description: damageDesc,
        Status: status,
        Photos_URL: url,
        Remarks: remarks,
        Dock_No: dockNo,
      };

      const res = await fetch("/api/vehicle-checklist/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.status !== "success") throw new Error(result.message || "Submission failed");

      setSuccessMsg(`✅ Checklist saved! GRN ${selectedGRN.GRN_ID} status → "Vehicle Docked"`);
      setArrivedGRNs(prev => prev.filter(g => g.GRN_ID !== selectedGRN.GRN_ID));
      // Reset
      setSelectedGRN(null); setGrnSearch(""); setDockNo(""); setTempAtGate("");
      setCleanliness(""); setFoulSmell(""); setProperArrangement(""); setDamageDesc("");
      setStatus(""); setPhotosUrl(""); setPhotoFile(null); setRemarks("");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Vehicle Checklist - IB</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${arrivedGRNs.length} vehicle${arrivedGRNs.length !== 1 ? "s" : ""} awaiting dock assignment`}
        </p>
      </CardHeader>

      <CardContent className="pt-6 space-y-7">
        {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
        {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

        {/* GRN ID */}
        <div className="space-y-2">
          <Label className="font-semibold">GRN ID <span className="text-red-500">*</span></Label>
          <div className="relative" ref={grnRef}>
            <Input
              placeholder="Search GRN, Vehicle or Customer..."
              value={grnSearch}
              onChange={e => { setGrnSearch(e.target.value); setShowGrnDrop(true); setSelectedGRN(null); }}
              onFocus={() => setShowGrnDrop(true)}
              className="font-mono"
            />
            {showGrnDrop && filtered.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filtered.map(grn => (
                  <button key={grn.GRN_ID} type="button" onClick={() => selectGRN(grn)}
                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0">
                    <div className="font-mono font-semibold text-sm">{grn.GRN_ID}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {grn.Customer_Name} · {grn.Vehicle_Number}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showGrnDrop && grnSearch && filtered.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-sm px-4 py-3 text-sm text-muted-foreground">
                No vehicles with "Vehicle Arrived" status found
              </div>
            )}
          </div>
        </div>

        {selectedGRN && (<>
          {/* Auto-filled fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Checklist GRN ID</Label>
              <Input value={`Checklist-${selectedGRN.GRN_ID}`} readOnly className="bg-muted font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input value={selectedGRN.Vehicle_Number} readOnly className="bg-muted" />
            </div>
          </div>

          {/* Dock No + Supervisor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dock No <span className="text-red-500">*</span></Label>
              <select
                value={dockNo}
                onChange={e => setDockNo(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select Dock...</option>
                {docks.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Supervisor Name</Label>
              <Input value={supervisorName} onChange={e => setSupervisorName(e.target.value)} placeholder="Supervisor name" />
            </div>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label className="text-amber-600 font-semibold">Temperature at Gate (°C)</Label>
            <Input type="number" step="0.1" value={tempAtGate} onChange={e => setTempAtGate(e.target.value)} placeholder="e.g. -8.5" className="w-48" />
          </div>

          {/* Cleanliness */}
          <div className="space-y-2">
            <Label className="font-semibold">Cleanliness <span className="text-red-500">*</span></Label>
            <ToggleGroup
              options={["Good", "Average", "Bad"]}
              value={cleanliness}
              onChange={setCleanliness}
              colorMap={{ Good: "bg-green-600 text-white", Average: "bg-yellow-500 text-white", Bad: "bg-red-600 text-white" }}
            />
          </div>

          {/* Foul Smell */}
          <div className="space-y-2">
            <Label className="font-semibold">Foul Smell <span className="text-red-500">*</span></Label>
            <ToggleGroup
              options={["Yes", "No"]}
              value={foulSmell}
              onChange={setFoulSmell}
              colorMap={{ Yes: "bg-red-600 text-white", No: "bg-green-600 text-white" }}
            />
          </div>

          {/* Proper Arrangement */}
          <div className="space-y-2">
            <Label className="font-semibold">Proper Arrangement <span className="text-red-500">*</span></Label>
            <ToggleGroup
              options={["Yes", "No"]}
              value={properArrangement}
              onChange={setProperArrangement}
              colorMap={{ Yes: "bg-green-600 text-white", No: "bg-red-600 text-white" }}
            />
          </div>

          {/* Damage Description */}
          <div className="space-y-2">
            <Label>Damage Description</Label>
            <Input value={damageDesc} onChange={e => setDamageDesc(e.target.value)} placeholder="Describe any damage (if any)..." />
          </div>

          {/* Overall Status */}
          <div className="space-y-2">
            <Label className="font-semibold">Status <span className="text-red-500">*</span></Label>
            <ToggleGroup
              options={["Passed", "Failed"]}
              value={status}
              onChange={setStatus}
              colorMap={{ Passed: "bg-green-600 text-white", Failed: "bg-red-600 text-white" }}
            />
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <Label className="font-semibold">Photos <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors text-sm text-muted-foreground">
                📷 {photoFile ? photoFile.name : "Choose Photo..."}
                <input type="file" accept="image/*" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
              </label>
              {photoFile && <span className="text-xs text-green-600">Ready to upload</span>}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Additional remarks..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Submission sets status to <span className="font-semibold text-blue-700">Vehicle Docked</span>
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-semibold"
            >
              {isSubmitting ? "Saving..." : "Save Checklist"}
            </button>
          </div>
        </>)}

        {!loading && arrivedGRNs.length === 0 && !selectedGRN && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold">No vehicles pending checklist</p>
            <p className="text-sm mt-1">All vehicles are docked or no GRN entries with "Vehicle Arrived" status.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
