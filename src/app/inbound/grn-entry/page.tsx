"use client";
import { GrnEntryForm } from "@/components/grn-entry-form";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function GrnEntryPage() {
  const { status } = useSession();
  if (status === "loading") return <div className="p-8 text-center">Loading...</div>;
  if (status === "unauthenticated") return <div className="p-8 text-center">Access Denied. Please log in.</div>;
  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <GrnEntryForm />
    </div>
  );
}
