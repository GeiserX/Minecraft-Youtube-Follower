# Development

## Live Code Updates

Changes to these files apply without rebuilding, because the development compose file mounts them:

- `bot/spectator-bot.js` - Restart bot container
- `streaming/capture-viewer.js` - Restart streaming container
- `streaming/streaming-service.py` - Restart streaming container

```bash
docker compose restart minecraft-spectator-bot  # For bot changes
docker compose restart streaming-service        # For streaming changes
```

## Rebuilding Images

`bot/bot-logic.js`, which holds the camera and player-following logic, is copied into the image and not mounted, so a change to it needs `docker compose up -d --build minecraft-spectator-bot`.

For dependency changes:

```bash
docker compose build --no-cache
docker compose up -d
```

## Tests

```bash
cd bot
npm install
npx jest --coverage
```

`npm install` builds `canvas`, which needs the Cairo, Pango, JPEG, GIF, SVG and Pixman development headers (`build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev libpixman-1-dev` on Debian or Ubuntu). The same tests run on every pull request as the `test` check. Logs, updates, restarts: [Usage](usage.md).

## Docs

The site is built by MkDocs from `docs/`. `pip install -r docs/requirements-docs.txt && mkdocs build --strict` builds it locally; the same strict build runs on every pull request, and a push to `main` deploys it.

## Security notes

- Never commit `.env`; it is in `.gitignore`.
- Keep stream keys secret, and set a strong `MUMBLE_SUPERUSER_PASSWORD`.
- The sign-in tokens live in the `minecraft-bot-auth` volume (`/app/config/.auth` in the bot container); never copy them into the repository.
- Put firewall rules in front of the exposed ports.

## Contributing

Pull requests are welcome.
