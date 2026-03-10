"use client";
import { VehicleChecklistForm } from "@/components/vehicle-checklist-form";
import { useSession } from "next-auth/react";

export default function VehicleChecklistPage() {
  const { status } = useSession();
  if (status === "loading") return <div className="p-8 text-center">Loading...</div>;
  if (status === "unauthenticated") return <div className="p-8 text-center">Access Denied.</div>;
  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <VehicleChecklistForm />
    </div>
  );
}
