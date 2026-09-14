"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export default function HomePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/agents" : "/login");
  }, [session, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-gray-500">
      Caricamento...
    </div>
  );
}
