"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="mt-4 w-full rounded-2xl bg-[var(--zx-surface)] px-4 py-4 text-left text-[18px] font-semibold text-[var(--zx-danger)]"
    >
      Log out
    </button>
  );
}
