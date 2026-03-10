"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-background">
      <div className="flex h-16 items-center px-4 w-full justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="font-bold text-xl mr-6">
            WMS
          </Link>
          <div className="flex space-x-4">
            <Link
              href="/inbound"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname.startsWith("/inbound") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              INBOUND
            </Link>
            <Link
              href="/outbound"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname.startsWith("/outbound") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              OUTBOUND
            </Link>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground mr-2">
                {session.user?.name} ({session.user?.email})
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/"
              className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
            >
              Log In / Sign Up
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
