import type { AgencyRole } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      agencyId: string;
      role: AgencyRole;
    } & DefaultSession["user"];
  }

  interface User {
    agencyId: string;
    role: AgencyRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agencyId?: string;
    role?: AgencyRole;
  }
}
