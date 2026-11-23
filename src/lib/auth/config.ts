import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/db";

const authSecret = process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  throw new Error("NEXTAUTH_SECRET must be configured before starting Turismo AI.");
}

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: authSecret,
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            memberships: {
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });
        const membership = user?.memberships[0];
        if (!user || !membership) return null;

        const validPassword = await compare(parsed.data.password, user.passwordHash);
        if (!validPassword) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          agencyId: membership.agencyId,
          role: membership.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.agencyId = user.agencyId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && typeof token.agencyId === "string" && token.role) {
        session.user.id = token.sub;
        session.user.agencyId = token.agencyId;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
