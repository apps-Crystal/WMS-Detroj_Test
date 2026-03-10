"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp } from "@/lib/dateUtils";

interface PendingPallet {
  Pallet_ID: string;
  GRN_ID: string;
}

interface FreeLocation {
  code: string;
  aisle: string;
  bay: string;
  level: string;
  depth: string;
}

interface Forklift {
  id: string;
  no: string;
  display: string;
}

export function PutawayForm() {
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [putawayId, setPutawayId] = useState("Generating...");
  
  // Data from backend
  const [pallets, setPallets] = useState<PendingPallet[]>([]);
  const [locations, setLocations] = useState<FreeLocation[]>([]);
  const [forklifts, setForklifts] = useState<Forklift[]>([]);

  // Form selections and searches
  const [palletSearch, setPalletSearch] = useState("");
  const [showPalletDrop, setShowPalletDrop] = useState(false);
  const [selectedPallet, setSelectedPallet] = useState<PendingPallet | null>(null);
  const palletRef = useRef<HTMLDivElement>(null);

  const [locSearch, setLocSearch] = useState("");
  const [showLocDrop, setShowLocDrop] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<FreeLocation | null>(null);
  const locRef = useRef<HTMLDivElement>(null);

  const [forkliftSearch, setForkliftSearch] = useState("");
  const [showForkliftDrop, setShowForkliftDrop] = useState(false);
  const [selectedForklift, setSelectedForklift] = useState<Forklift | null>(null);
  const forkliftRef = useRef<HTMLDivElement>(null);

  const [movedBy, setMovedBy] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (session?.user?.name) setMovedBy(session.user.name);
    else if (session?.user?.email) setMovedBy(session.user.email);
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [idRes, dataRes] = await Promise.all([
        fetch("/api/putaway/generate-id", { cache: "no-store" }).then(res => res.json()),
        fetch("/api/putaway/data", { cache: "no-store" }).then(res => res.json())
      ]);
      
      if (idRes.nextId) setPutawayId(idRes.nextId);
      if (dataRes.pallets) setPallets(dataRes.pallets);
      if (dataRes.locations) setLocations(dataRes.locations);
      if (dataRes.forklifts) setForklifts(dataRes.forklifts);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load initial data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter items
  const filteredPallets = pallets.filter(p => !palletSearch || p.Pallet_ID.toLowerCase().includes(palletSearch.toLowerCase()));
  const filteredLocs = locations.filter(l => !locSearch || l.code.toLowerCase().includes(locSearch.toLowerCase()));
  const filteredForklifts = forklifts.filter(f => !forkliftSearch || f.display.toLowerCase().includes(forkliftSearch.toLowerCase()));

  // Document Click Listeners
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (palletRef.current && !palletRef.current.contains(e.target as Node)) setShowPalletDrop(false);
      if (locRef.current && !locRef.current.contains(e.target as Node)) setShowLocDrop(false);
      if (forkliftRef.current && !forkliftRef.current.contains(e.target as Node)) setShowForkliftDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const selectPallet = (p: PendingPallet) => {
    setSelectedPallet(p); setPalletSearch(p.Pallet_ID); setShowPalletDrop(false);
  };
  
  const selectLoc = (l: FreeLocation) => {
    setSelectedLoc(l); setLocSearch(l.code); setShowLocDrop(false);
  };
  
  const selectForklift = (f: Forklift) => {
    setSelectedForklift(f); setForkliftSearch(f.display); setShowForkliftDrop(false);
  };

  const handleSubmit = async () => {
    if (!selectedPallet) return setErrorMsg("Please select a Pallet.");
    if (!selectedLoc) return setErrorMsg("Please select a Location.");
    if (!selectedForklift) return setErrorMsg("Please select a Forklift.");
    
    setIsSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const payload = {
        Putaway_ID: putawayId,
        GRN_ID: selectedPallet.GRN_ID,
        Pallet_ID: selectedPallet.Pallet_ID,
        Assigned_Location: selectedLoc.code,
        Assigned_Aisle: selectedLoc.aisle,
        Assigned_Bay: selectedLoc.bay,
        Assigned_Level: selectedLoc.level,
        Assigned_Depth: selectedLoc.depth,
        Timestamp: formatTimestamp(),
        Moved_By: movedBy,
        Forklift_ID: selectedForklift.id,
      };

      const res = await fetch("/api/putaway/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (d.status !== "success") throw new Error(d.message || "Submission failed");

      setSuccessMsg(`✅ Putaway ${putawayId} successful! Pallet assigned to ${selectedLoc.code}`);
      
      // Cleanup UI
      setSelectedPallet(null); setPalletSearch("");
      setSelectedLoc(null); setLocSearch("");
      setSelectedForklift(null); setForkliftSearch("");
      
      // Remove used options locally
      setPallets(prev => prev.filter(p => p.Pallet_ID !== payload.Pallet_ID));
      setLocations(prev => prev.filter(l => l.code !== payload.Assigned_Location));
      
      // Refresh ID
      setPutawayId("Generating...");
      fetch("/api/putaway/generate-id").then(r => r.json()).then(d => d.nextId && setPutawayId(d.nextId));

    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-xl">04 Putaway</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading available pallets and locations..." : `${pallets.length} Pallets staging • ${locations.length} Free Locations`}
        </p>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        {successMsg && <div className="p-4 text-green-700 bg-green-50 border border-green-200 rounded-md text-sm font-medium">{successMsg}</div>}
        {errorMsg && <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md text-sm">{errorMsg}</div>}

        <div className="space-y-2">
          <Label className="text-blue-700 font-medium">Putaway_ID <span className="text-red-500">*</span></Label>
          <Input value={putawayId} readOnly className="bg-muted font-mono" />
        </div>

        <div className="space-y-2">
          <Label className="text-blue-700 font-medium">Pallet_ID <span className="text-red-500">*</span></Label>
          <div className="relative" ref={palletRef}>
            <Input
              placeholder="Search staging pallets..."
              value={palletSearch}
              onChange={e => { setPalletSearch(e.target.value); setShowPalletDrop(true); setSelectedPallet(null); }}
              onFocus={() => setShowPalletDrop(true)}
              className="font-mono bg-white"
            />
            {showPalletDrop && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filteredPallets.slice(0, 50).map(p => (
                  <button key={p.Pallet_ID} type="button" onClick={() => selectPallet(p)}
                    className="w-full px-4 py-2 text-left hover:bg-accent border-b last:border-0 font-mono text-sm">
                    {p.Pallet_ID} <span className="text-muted-foreground ml-2 text-xs">(GRN: {p.GRN_ID})</span>
                  </button>
                ))}
                {filteredPallets.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No unoccupied staging pallets found.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>GRN_ID</Label>
          <Input value={selectedPallet?.GRN_ID || ""} readOnly className="bg-muted font-mono text-muted-foreground" />
        </div>

        <div className="border-t my-4" />

        <div className="space-y-2">
          <Label className="text-blue-700 font-medium">Assigned_Location <span className="text-red-500">*</span></Label>
          <div className="relative" ref={locRef}>
            <Input
              placeholder="Search empty locations..."
              value={locSearch}
              onChange={e => { setLocSearch(e.target.value); setShowLocDrop(true); setSelectedLoc(null); }}
              onFocus={() => setShowLocDrop(true)}
              className="font-mono bg-white"
            />
            {showLocDrop && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filteredLocs.slice(0, 50).map(l => (
                  <button key={l.code} type="button" onClick={() => selectLoc(l)}
                    className="w-full px-4 py-2 text-left hover:bg-accent border-b last:border-0 font-mono text-sm leading-tight">
                    {l.code}
                  </button>
                ))}
                {filteredLocs.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No free locations found.</div>}
              </div>
            )}
          </div>
        </div>

        {selectedLoc && (
          <div className="grid grid-cols-4 gap-4 bg-muted/20 p-4 rounded-md border">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Assigned_Aisle</Label>
              <div className="font-mono text-sm">{selectedLoc.aisle}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Assigned_Bay</Label>
              <div className="font-mono text-sm">{selectedLoc.bay}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Assigned_Level</Label>
              <div className="font-mono text-sm">{selectedLoc.level}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Assigned_Depth</Label>
              <div className="font-mono text-sm">{selectedLoc.depth}</div>
            </div>
          </div>
        )}

        <div className="border-t my-4" />

        <div className="space-y-2">
          <Label className="text-blue-700 font-medium">Forklift_ID <span className="text-red-500">*</span></Label>
           <div className="relative" ref={forkliftRef}>
            <Input
              placeholder="Search forklifts..."
              value={forkliftSearch}
              onChange={e => { setForkliftSearch(e.target.value); setShowForkliftDrop(true); setSelectedForklift(null); }}
              onFocus={() => setShowForkliftDrop(true)}
              className="font-mono bg-white"
            />
            {showForkliftDrop && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                {filteredForklifts.map(f => (
                  <button key={f.id} type="button" onClick={() => selectForklift(f)}
                    className="w-full px-4 py-3 text-left hover:bg-accent border-b last:border-0 font-mono text-sm">
                    {f.display}
                  </button>
                ))}
                {filteredForklifts.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No forklifts found.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Timestamp</Label>
            <Input value={formatTimestamp()} readOnly className="bg-muted font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Moved_By</Label>
            <Input value={movedBy} onChange={e => setMovedBy(e.target.value)} className="bg-white" />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end mt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
            className="px-10 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 font-bold text-lg shadow-sm"
          >
            {isSubmitting ? "Submitting..." : "Save Putaway"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
