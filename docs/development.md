# Development

## Live Code Updates

Code changes apply without rebuilding:

- `bot/spectator-bot.js` - Restart bot container
- `streaming/capture-viewer.js` - Restart streaming container
- `streaming/streaming-service.py` - Restart streaming container

```bash
docker compose restart minecraft-spectator-bot  # For bot changes
docker compose restart streaming-service        # For streaming changes
```

## Logs

```bash
docker compose logs -f minecraft-spectator-bot  # Bot logs
docker compose logs -f streaming-service        # Streaming logs
docker compose logs -f                          # All logs
```

## Rebuilding Images

For dependency changes:

```bash
docker compose build --no-cache
docker compose up -d
```

## Maintenance

```bash
docker compose pull && docker compose build && docker compose up -d   # update
docker compose restart                                                # restart
docker compose down                                                   # stop
docker compose logs -f mumble-server                                  # one service's log
```

With the published images, add `-f docker-compose.prod.yml` after `docker compose`.

## Security notes

- Never commit `.env`; it is in `.gitignore`.
- Keep stream keys secret, and set a strong `MUMBLE_SUPERUSER_PASSWORD`.
- The sign-in tokens live in the `minecraft-bot-auth` volume (`/app/config/.auth` in the bot container); never copy them into the repository.
- Put firewall rules in front of the exposed ports.

## Contributing

Pull requests are welcome.
