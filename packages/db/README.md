# @v-agent/db

Schema SQL e client Supabase per V Agent.

## Migrazioni

Le migrazioni in `migrations/` sono numerate e vanno applicate in ordine con la Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

In locale, con `supabase start` attivo:

```bash
for f in migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
```
