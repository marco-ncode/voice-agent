"use client";

import { useState } from "react";
import { useOrg } from "./providers/OrgProvider";

export function OrgSwitcher() {
  const { organizations, selectedOrgId, setSelectedOrgId, createOrganization } = useOrg();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createOrganization(name.trim());
      setName("");
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (creating) {
    return (
      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome organizzazione"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
        />
        <div className="flex gap-2 text-xs">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-brand-600 px-2 py-1 text-white disabled:opacity-50"
          >
            Crea
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          >
            Annulla
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={selectedOrgId ?? ""}
        onChange={(e) => setSelectedOrgId(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
      >
        {organizations.length === 0 && <option value="">Nessuna organizzazione</option>}
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => setCreating(true)}
        className="text-left text-xs text-brand-600 hover:underline"
      >
        + Nuova organizzazione
      </button>
    </div>
  );
}
