"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";

const modules = [
  {
    href: "/inbound/vehicle-entry",
    title: "Vehicle Entry - IB",
    description: "Register new inbound vehicles. Captures vehicle, driver, customer, invoice and LR details.",
    icon: "🚛",
    badge: "Step 1",
  },
  {
    href: "/inbound/grn-entry",
    title: "Invoice Entry / GRN Entry - IB",
    description: "Select a pending GRN and record SKU-level invoice quantities. Sets status to Vehicle Arrived.",
    icon: "📋",
    badge: "Step 2",
  },
  {
    href: "/inbound/vehicle-checklist",
    title: "Vehicle Checklist - IB",
    description: "Inspect vehicle at dock — cleanliness, temperature, foul smell, arrangement. Sets status to Vehicle Docked.",
    icon: "✅",
    badge: "Step 3",
  },
  {
    href: "/inbound/pallet-build",
    title: "Pallet Build (1 Pallet / 1 SKU) - IB",
    description: "Map unloaded SKUs to Pallets via scanning. Creates unique Pallet GRNs. Mark 'Vehicle Completed' when done.",
    icon: "📦",
    badge: "Step 4A",
  },
  {
    href: "/inbound/multiple-pallet-build",
    title: "Pallet Build (Multi Pallet) - IB",
    description: "Add multiple pallets for a single SKU at once. Scan multiple barcodes and bulk submit.",
    icon: "📚",
    badge: "Step 4B",
  },
  {
    href: "/inbound/putaway",
    title: "Putaway - IB",
    description: "Assign built pallets to physical warehouse locations using forklifts.",
    icon: "🏗️",
    badge: "Step 5",
  },
  {
    href: "/inbound/grn-issue",
    title: "GRN Issue - IB",
    description: "Finalize GRN. Review shortages between Invoice vs Actual built.",
    icon: "✅",
    badge: "Step 6",
  },
  {
    href: "/inbound/pallet-merge",
    title: "Pallet Merge - IB",
    description: "Consolidate inventory from one pallet into another.",
    icon: "🔀",
    badge: "Utility",
  },
];

export default function InboundPage() {
  const { status } = useSession();
  if (status === "loading") return <div className="p-8 text-center">Loading...</div>;
  if (status === "unauthenticated") return <div className="p-8 text-center">Access Denied. Please log in.</div>;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Inbound Operations</h1>
        <p className="text-muted-foreground mt-1">Manage all inbound warehouse activities step by step.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="hover:border-primary hover:shadow-md transition-all cursor-pointer h-full group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{mod.icon}</span>
                  <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-full">
                    {mod.badge}
                  </span>
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors mt-2">
                  {mod.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
