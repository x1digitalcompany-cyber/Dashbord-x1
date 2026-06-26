import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "E-mail", type: "email" },
        password: { label: "Senha",  type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) return null;

        try {
          const { data: user, error } = await supabase
            .from("users")
            .select("id, email, name, password_hash, role, is_active")
            .eq("email", email)
            .eq("is_active", true)
            .maybeSingle();

          if (error) {
            console.error("[auth] Supabase:", error.message);
            return null;
          }
          if (!user?.password_hash) return null;

          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name, role: user.role };
        } catch (err) {
          console.error("[auth] authorize:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id: string }).id     = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
};
