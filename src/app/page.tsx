"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const { data: session, status } = useSession();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [errorStr, setErrorStr] = useState("");

  if (status === "loading") {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorStr("");
    setMsg("");
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    setLoading(false);
    if (res?.error) {
      setErrorStr(res.error);
    } else {
      window.location.reload();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorStr("");
    setMsg("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign up");
      setMsg("Sign up successful! Your access is PENDING. Wait for admin approval.");
      setIsLogin(true);
      setPassword("");
    } catch (err: any) {
      setErrorStr(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Warehouse Management System</h1>
        
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isLogin ? "Log In" : "Sign Up"}</CardTitle>
          </CardHeader>
          <CardContent>
            {errorStr && <div className="p-3 bg-destructive/15 text-destructive border border-destructive/20 rounded-md mb-4 text-sm font-medium">{errorStr}</div>}
            {msg && <div className="p-3 bg-green-100/50 text-green-700 border border-green-200 rounded-md mb-4 text-sm font-medium">{msg}</div>}
            
            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-2 font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors">
                  {loading ? "Logging in..." : "Log In"}
                </button>
                <div className="text-center mt-4">
                  <button type="button" onClick={() => setIsLogin(false)} className="text-sm text-primary hover:underline underline-offset-4">
                    Need an account? Sign Up
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading} className="w-full py-2 font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors">
                  {loading ? "Signing up..." : "Sign Up"}
                </button>
                <div className="text-center mt-4">
                  <button type="button" onClick={() => setIsLogin(true)} className="text-sm text-primary hover:underline underline-offset-4">
                    Already have an account? Log In
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <h1 className="text-3xl font-bold mb-8">Welcome, {session.user?.name}!</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link href="/inbound">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-xl">INBOUND</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage inbound operations and vehicle entries.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/outbound">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-xl">OUTBOUND</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage outbound operations and shipments.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
