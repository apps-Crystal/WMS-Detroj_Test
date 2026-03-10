"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimestamp, convertInputDate } from "@/lib/dateUtils";


const formSchema = z.object({
  GRN_ID: z.string(),
  Arrival_Time: z.string(),
  Vehicle_Number: z.string().min(1, "Vehicle number is required"),
  Driver_Name: z.string().min(1, "Driver name is required"),
  Customer_Name: z.string().min(1, "Customer name is required"),
  Invoice_Number: z.string().min(1, "Invoice number is required"),
  Invoice_Date: z.string().min(1, "Invoice date is required"),
  LR_Number: z.string().min(1, "LR number is required"),
  Seal_Intact: z.enum(["Yes", "No"]),
  Temp_Display_C: z.string().optional(),
  Created_By_Email: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function VehicleEntryForm() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadWarning, setUploadWarning] = useState("");

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [lrPhotoFile, setLrPhotoFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      GRN_ID: "Generating...",
      Arrival_Time: new Date().toISOString(),
      Seal_Intact: "Yes" as const,
      Created_By_Email: "",
    },
  });

  const refreshGrnId = async () => {
    try {
      const grnRes = await fetch("/api/generate-grn-id", { cache: 'no-store' });
      const grnData = await grnRes.json();
      if (grnData.grnId) setValue("GRN_ID", grnData.grnId);
    } catch (err) {
      console.error("Failed to refresh GRN ID", err);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const custRes = await fetch("/api/customers", { cache: 'no-store' });
        const custData = await custRes.json();
        if (custData.customers) setCustomers(custData.customers);
        await refreshGrnId();
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }
    loadInitialData();
      setValue("Arrival_Time", formatTimestamp());
  }, [setValue]);

  useEffect(() => {
    if (session?.user?.email) {
      setValue("Created_By_Email", session.user.email);
    }
  }, [session, setValue]);

  // Returns empty string if upload fails — non-blocking
  const uploadFile = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return "";
      const data = await res.json();
      return data.url || "";
    } catch {
      return "";
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSuccessMsg("");
    setErrorMsg("");
    setUploadWarning("");
    try {
      let invoiceUrl = "";
      let lrPhotoUrl = "";
      let filesSkipped = false;

      if (invoiceFile) {
        invoiceUrl = await uploadFile(invoiceFile);
        if (!invoiceUrl) filesSkipped = true;
      }
      if (lrPhotoFile) {
        lrPhotoUrl = await uploadFile(lrPhotoFile);
        if (!lrPhotoUrl) filesSkipped = true;
      }
      if (filesSkipped) {
        setUploadWarning("⚠️ File upload skipped — redeploy Apps Script to enable Drive uploads. Entry will still be saved.");
      }

      const payload = {
        ...data,
        Arrival_Time: formatTimestamp(),
        Invoice_Date: convertInputDate(data.Invoice_Date),
        Invoice_URL: invoiceUrl,
        LR_Photo: lrPhotoUrl,
      };

      const res = await fetch("/api/vehicle-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save data");

      // Reset the entire form to blank state
      reset({
        GRN_ID: "Generating...",
        Arrival_Time: formatTimestamp(),
        Seal_Intact: "Yes",
        Created_By_Email: session?.user?.email || "",
        Vehicle_Number: "",
        Driver_Name: "",
        Customer_Name: "",
        Invoice_Number: "",
        Invoice_Date: "",
        LR_Number: "",
        Temp_Display_C: "",
      });
      // Clear file inputs
      setInvoiceFile(null);
      setLrPhotoFile(null);
      // Fetch fresh GRN ID for next entry
      await refreshGrnId();
      setSuccessMsg("Vehicle entry saved successfully! Form cleared for next entry.");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Vehicle Entry - IB</CardTitle>
      </CardHeader>
      <CardContent>
        {successMsg && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-md">{successMsg}</div>}
        {errorMsg && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">{errorMsg}</div>}
        {uploadWarning && <div className="p-3 mb-4 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md text-sm">{uploadWarning}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GRN ID (Auto Generated)</Label>
              <Input {...register("GRN_ID")} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Arrival Time</Label>
              <Input {...register("Arrival_Time")} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Created By</Label>
              <Input {...register("Created_By_Email")} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input {...register("Vehicle_Number")} placeholder="e.g. MH12AB1234" />
              {errors.Vehicle_Number && <span className="text-sm text-red-500">{errors.Vehicle_Number.message}</span>}
            </div>
            <div className="space-y-2">
              <Label>Driver Name</Label>
              <Input {...register("Driver_Name")} placeholder="Driver Name" />
              {errors.Driver_Name && <span className="text-sm text-red-500">{errors.Driver_Name.message}</span>}
            </div>
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <select
                {...register("Customer_Name")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a Customer</option>
                {customers.map((cust, idx) => (
                  <option key={idx} value={cust}>{cust}</option>
                ))}
              </select>
              {errors.Customer_Name && <span className="text-sm text-red-500">{errors.Customer_Name.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input {...register("Invoice_Number")} placeholder="INV-1234" />
              {errors.Invoice_Number && <span className="text-sm text-red-500">{errors.Invoice_Number.message}</span>}
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input type="date" {...register("Invoice_Date")} />
              {errors.Invoice_Date && <span className="text-sm text-red-500">{errors.Invoice_Date.message}</span>}
            </div>
            <div className="space-y-2">
              <Label>Invoice File (Upload)</Label>
              <Input type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>LR Number</Label>
              <Input {...register("LR_Number")} placeholder="LR-1234" />
              {errors.LR_Number && <span className="text-sm text-red-500">{errors.LR_Number.message}</span>}
            </div>
            <div className="space-y-2">
              <Label>LR Photo (Upload)</Label>
              <Input type="file" onChange={(e) => setLrPhotoFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seal Intact</Label>
              <select
                {...register("Seal_Intact")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Temp Display (C)</Label>
              <Input type="number" step="0.1" {...register("Temp_Display_C")} placeholder="e.g. 25.5" />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Vehicle Entry"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
