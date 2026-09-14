"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./providers/AuthProvider";
import { OrgSwitcher } from "./OrgSwitcher";

const NAV_ITEMS = [
  { href: "/agents", label: "Agenti" },
  { href: "/settings/api-keys", label: "Chiavi API" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white px-4 py-6">
      <div className="text-xl font-semibold text-brand-700">V Agent</div>

      <div className="mt-6">
        <OrgSwitcher />
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 pt-4">
        <p className="truncate text-xs text-gray-500">{session?.user.email}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 text-sm text-gray-500 hover:text-gray-800"
        >
          Esci
        </button>
      </div>
    </aside>
  );
}
