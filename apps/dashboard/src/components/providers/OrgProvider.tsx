"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface OrgContextValue {
  organizations: Organization[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  createOrganization: (name: string) => Promise<Organization>;
}

const OrgContext = createContext<OrgContextValue | null>(null);
const STORAGE_KEY = "vagent:selectedOrgId";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const orgs = await apiFetch<Organization[]>("/v1/organizations");
      setOrganizations(orgs);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedOrgIdState(stored);
  }, []);

  useEffect(() => {
    const stillExists = organizations.some((o) => o.id === selectedOrgId);
    if (!stillExists && organizations.length > 0) {
      setSelectedOrgId(organizations[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations]);

  function setSelectedOrgId(id: string) {
    setSelectedOrgIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  async function createOrganization(name: string): Promise<Organization> {
    const org = await apiFetch<Organization>("/v1/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await refresh();
    setSelectedOrgId(org.id);
    return org;
  }

  return (
    <OrgContext.Provider
      value={{
        organizations,
        selectedOrgId,
        setSelectedOrgId,
        loading,
        refresh,
        createOrganization,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
