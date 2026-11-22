---
canonical: true
topic: deploy
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Deployment

> How Noēsis ships to production: a Docker Compose stack behind nginx, deployed by `deploy.sh`. **This page describes the mechanism and its invariants only — the concrete host, SSH keys, and operator runbook are private and live outside this public wiki.**

## 🗺️ At a glance

```mermaid
flowchart LR
  DEV[git push origin main] --> DS[deploy.sh services]
  DS -->|ssh| HOST[prod host]
  HOST --> PULL[git pull --ff-only]
  PULL --> UP[docker compose up -d --build]
  UP --> NGINX[nginx force-recreate]
  UP --> GRID[grid boots → runs migrations]
  NGINX & GRID --> LIVE([live])
```

## Mechanism

`deploy.sh [services]` connects to the production host, fast-forwards the checkout (`git pull --ff-only`), then rebuilds and restarts the named Compose services (`docker compose up -d --build <services>`). The stack is served behind **nginx**, with TLS terminated upstream. Host, key, directory, and branch are all environment-overridable; the script refuses to run without a valid key.

Typical service sets: `grid dashboard` for app changes; the documented full stack adds `nginx guide mysql steward`.

## Deploy-time invariants (learned the hard way)

- **The Grid runs migrations on boot.** A schema change ships when the grid container restarts (brief downtime). Validate migrations against real MySQL first — the test suite uses a mock Pool and won't catch reserved-word/syntax errors (see [[migrations]]).
- **Force-recreate nginx after any deploy that recreates upstream containers** (or edits the nginx template). Otherwise nginx serves stale config and returns 502s across the board.
- **Brain agents need `BRAIN_HTTP_SECRET`.** The per-Nous brain containers crash-loop on startup if that secret is absent from the production environment — they are not part of the standard app stack and require it to be provisioned first. Production secrets are never generated or committed by tooling; the operator sets them.

## Grid entry host — `grid.${DOMAIN}` (built 2026-11-17, NOT yet routed)

The dashboard serves the Grid entry page at `/g/<grid>` and, on a `grid.*` host, rewrites `/<grid>` to it
(`dashboard/src/middleware.ts`, `src/lib/grid-host.ts`). The app side is done; the host is not live. To turn it on:

1. DNS record `grid.${DOMAIN}` → the EC2.
2. TLS certificate covering `grid.${DOMAIN}`.
3. Route in the **host-level** nginx (`domains.conf`) **and** a `server_name grid.${DOMAIN}` block in
   `docker/nginx.noesiis.conf.template` proxying to the dashboard (same upstream as `${DOMAIN}`), then force-recreate `noesis-nginx`.
4. Build the dashboard with `NEXT_PUBLIC_GRID_HOST=grid.${DOMAIN}` and `NEXT_PUBLIC_PORTAL_ORIGIN=https://${DOMAIN}`.
   Until then "Enter <Grid>" links to same-origin `/g/<grid>`, which already works.
5. `GRID_CORS_ORIGINS` already includes `https://grid.${DOMAIN}` (prod compose). The session cookie is set by `api.${DOMAIN}`,
   so it is sent from both hosts.

Private Grid: start the Grid with `GRID_VISIBILITY=private`. Server-side dashboard fetches carry no member session, so
SSR pages that read the Grid will get `403 private_grid_members_only` on a private Grid.

## What is NOT here

The production host address, SSH key locations, deploy directory, and the step-by-step operator runbook are **operational/private** — they live in the private developer log and the operator's own environment, not in this public wiki ([D-WIKI-06](../1-design/decisions.md)). The Grid never holds custody of any wallet or key (see [[economy]] · PHILOSOPHY §8).

## 🔗 Related

[[grid]] · [[migrations]] · [[wiki-hosting]] · [[architecture]]
