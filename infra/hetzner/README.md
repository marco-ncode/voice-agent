# Deploy su Hetzner (bare-metal / GPU dedicata)

Note per il deploy della versione non containerizzata di `services/inference` su un
nodo Hetzner con GPU Blackwell dedicata (o di qualunque componente per cui il
container Docker non sia la scelta giusta, es. per accesso diretto al driver NVIDIA).

## Setup base nodo GPU

1. Ubuntu 22.04 LTS, driver NVIDIA + CUDA 12.4 installati dal repository ufficiale NVIDIA.
2. Installare vLLM (o TGI) per servire il modello LLM scelto come server OpenAI-compatible:
   ```bash
   pip install vllm
   vllm serve <hf-model-id> --port 8001 --host 0.0.0.0
   ```
3. Avviare `services/inference` (vedi il suo README) puntato a `LOCAL_LLM_BASE_URL=http://localhost:8001/v1`.
4. Esporre `services/inference` (porta 8000) solo sulla rete privata/VPN che collega il nodo GPU
   all'istanza di `apps/api` — non esporlo pubblicamente.

## Rete

- `apps/api` può girare su un'istanza cloud separata (o in un altro provider) e raggiungere
  il nodo GPU Hetzner via VPN (es. WireGuard) o rete privata Hetzner, impostando
  `INFERENCE_SERVICE_URL` di conseguenza.

## TODO

- Provisioning automatizzato (Terraform/Ansible) — non ancora implementato in questo scaffold.
- Autoscaling / spin-down: fuori scope per ora, il servizio è pensato always-on.
