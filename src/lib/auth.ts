import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        if (!APPS_SCRIPT_URL) {
          throw new Error("APPS_SCRIPT_URL is not configured in .env.local");
        }

        try {
          const url = `${APPS_SCRIPT_URL}?action=login&email=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}`;
          const res = await fetch(url, { redirect: 'follow' });
          const result = await res.json();

          if (result.status === "error") {
            throw new Error(result.message);
          }

          if (result.access !== "GRANTED") {
            throw new Error("Access is PENDING. Please wait for admin approval.");
          }

          return {
            id: result.email,
            name: result.name,
            email: result.email,
          };
        } catch (error: any) {
          throw new Error(error.message || "Login failed");
        }
      }
    })
  ],
  session: { strategy: "jwt" as any },
  secret: process.env.NEXTAUTH_SECRET || "fallback_development_secret_only",
  callbacks: {
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.name = token.name;
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};

export const handler = NextAuth(authOptions);
