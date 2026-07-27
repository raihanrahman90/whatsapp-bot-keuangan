# WhatsApp Bot Keuangan

The WhatsApp bot and REST API run together as one Node.js service. The web UI remains a separate container.

The bot uses an incremental TypeScript setup: it compiles the current JavaScript modules into `bot/dist/`, while new modules can be added as fully typed `.ts` files.

Prisma models live in `bot/prisma/schema.prisma` and all application database access uses the generated Prisma client. Knex remains responsible for applying the existing migrations; do not run Prisma migrations until the migration history has been deliberately baselined.

## Start locally

1. Copy `.env.example` to `.env` and replace both secret values with unique random strings.
2. Keep `SESSION_COOKIE_SECURE=false` when using `http://localhost:8080`.
3. Run `docker compose up --build`.
4. Scan the QR code printed by the `whatsapp-bot` container, then open `http://localhost:8080`.

## Production settings

- Serve the dashboard over HTTPS and set `SESSION_COOKIE_SECURE=true`.
- Set `CORS_ORIGIN` to the exact dashboard origin.
- Set `TRUST_PROXY=1` only when one trusted proxy is directly in front of the service.
- The combined service exposes the API on port `3001`. WhatsApp authentication remains in `bot/auth_info/`.
