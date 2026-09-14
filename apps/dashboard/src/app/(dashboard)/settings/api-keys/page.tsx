"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useOrg } from "@/components/providers/OrgProvider";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const { selectedOrgId } = useOrg();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const data = await apiFetch<ApiKey[]>(`/v1/organizations/${selectedOrgId}/api-keys`);
      setKeys(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ key: string }>(
        `/v1/organizations/${selectedOrgId}/api-keys`,
        { method: "POST", body: JSON.stringify({ name: name.trim() }) },
      );
      setNewKey(created.key);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la creazione");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!selectedOrgId) return;
    if (!window.confirm("Revocare questa chiave API? Le richieste che la usano falliranno.")) return;
    await apiFetch(`/v1/organizations/${selectedOrgId}/api-keys/${id}`, { method: "DELETE" });
    await refresh();
  }

  if (!selectedOrgId) {
    return <p className="text-sm text-gray-500">Seleziona prima un&apos;organizzazione.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Chiavi API</h1>
      <p className="mt-1 text-sm text-gray-500">
        Usale per collegare V Agent a sistemi esterni (gestori SIP/VoIP, CRM, ecc.) tramite le
        API pubbliche <code>/v1/conversations</code>, <code>/v1/webhooks</code> e{" "}
        <code>/v1/realtime</code>.
      </p>

      <form onSubmit={handleCreate} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome chiave (es. Twilio prod)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Crea chiave
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {newKey && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">
            Copia questa chiave ora: non potrà essere visualizzata di nuovo.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-amber-900">
            {newKey}
          </code>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Caricamento...</p>
        ) : keys.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna chiave API creata.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Prefisso</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">{key.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{key.key_prefix}...</td>
                  <td className="px-4 py-2">
                    {key.revoked_at ? (
                      <span className="text-red-600">Revocata</span>
                    ) : (
                      <span className="text-green-600">Attiva</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!key.revoked_at && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-red-600 hover:underline"
                      >
                        Revoca
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
