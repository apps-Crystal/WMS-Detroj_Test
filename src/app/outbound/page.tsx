"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";

const modules = [
  {
    href: "/outbound/dn-entry",
    title: "DN Entry - OB",
    description: "Create a new Delivery Note (DN) with multiple SKU lines. Sets status to Order Created.",
    icon: "📝",
    badge: "Step 1",
  },
  {
    href: "/outbound/pick-assignment",
    title: "Pick Assignment - OB",
    description: "Assign DN lines to warehouse pickers. Allocate pallets and locations for each order.",
    icon: "🎯",
    badge: "Step 2",
    disabled: true,
  },
  {
    href: "/outbound/pick-execution",
    title: "Pick Execution - OB",
    description: "Execute and confirm warehouse picks against assignments.",
    icon: "🧑‍🏭",
    badge: "Step 3",
    disabled: true,
  },
  {
    href: "/outbound/vehicle-entry",
    title: "Vehicle Entry - OB",
    description: "Register outbound dispatch vehicle, driver and transport details.",
    icon: "🚚",
    badge: "Step 4",
    disabled: true,
  },
  {
    href: "/outbound/dispatch-form",
    title: "Dispatch Form - OB",
    description: "Finalize dispatch quantities, generate packing list and update shortage.",
    icon: "📦",
    badge: "Step 5",
    disabled: true,
  },
  {
    href: "/outbound/proof-of-delivery",
    title: "Proof of Delivery - OB",
    description: "Capture and upload delivery confirmation and e-POD documents.",
    icon: "✅",
    badge: "Step 6",
    disabled: true,
  },
];

export default function OutboundPage() {
  const { status } = useSession();
  if (status === "loading") return <div className="p-8 text-center">Loading...</div>;
  if (status === "unauthenticated") return <div className="p-8 text-center">Access Denied. Please log in.</div>;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Outbound Operations</h1>
        <p className="text-muted-foreground mt-1">Manage all outbound dispatch activities step by step.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const card = (
            <Card className={`h-full group transition-all ${mod.disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:shadow-md cursor-pointer"}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{mod.icon}</span>
                  <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-full">{mod.badge}</span>
                </div>
                <CardTitle className={`text-lg mt-2 ${!mod.disabled && "group-hover:text-primary"} transition-colors`}>
                  {mod.title}
                  {mod.disabled && <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Coming Soon</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              </CardContent>
            </Card>
          );
          return mod.disabled ? (
            <div key={mod.href}>{card}</div>
          ) : (
            <Link key={mod.href} href={mod.href}>{card}</Link>
          );
        })}
      </div>
    </div>
  );
}
