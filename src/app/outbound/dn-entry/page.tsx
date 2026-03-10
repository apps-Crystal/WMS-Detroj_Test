"use client";
import { DnEntryForm } from "@/components/dn-entry-form";
import { useSession } from "next-auth/react";

export default function DnEntryPage() {
  const { status } = useSession();
  if (status === "loading") return <div className="p-8 text-center">Loading...</div>;
  if (status === "unauthenticated") return <div className="p-8 text-center">Access Denied.</div>;
  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4">
      <DnEntryForm />
    </div>
  );
}
