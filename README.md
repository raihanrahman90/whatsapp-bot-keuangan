# WhatsApp Bot Keuangan

## Start locally

1. Copy `.env.example` to `.env` and replace both secret values with unique random strings.
2. Keep `SESSION_COOKIE_SECURE=false` when using `http://localhost:8080`.
3. Run `docker compose up --build`.
4. Scan the QR code printed by the `whatsapp-bot` container, then open `http://localhost:8080`.

## Production settings

- Serve the dashboard over HTTPS and set `SESSION_COOKIE_SECURE=true`.
- Set `CORS_ORIGIN` to the exact dashboard origin.
- Set `TRUST_PROXY=1` only when one trusted proxy is directly in front of the backend.
- Do not expose the bot's port 3000; the backend reaches it only through the Docker network.
