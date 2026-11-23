import { redirect } from "next/navigation";

import { getAgencySession } from "@/lib/auth/tenant";

export default async function HomePage() {
  const session = await getAgencySession();
  redirect(session ? "/dashboard" : "/login");
}
