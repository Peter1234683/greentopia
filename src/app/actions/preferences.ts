"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function toggleLargeText() {
  const store = await cookies();
  const on = store.get("gt_large")?.value === "1";
  store.set("gt_large", on ? "0" : "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
