# Usage

## What the stream shows

The bot joins your server in spectator mode and reads the player list every `CHECK_INTERVAL_MS` (5 seconds by default). It follows one player at a time from behind and above, facing the player's eyes, and when more than one player is online it moves on to the next one every `SWITCH_INTERVAL_MS` (30 seconds by default). The overlay, top-left by default, says `Now following: <name>`, and the music you added loops underneath (see [Adding Minecraft music](configuration.md#adding-minecraft-music)). With `CAMERA_MODE=spectate` the stream shows the followed player's own first-person view instead.

When the last player leaves, the stream stops. It starts again when a player joins. See [When the server is empty](configuration.md#when-the-server-is-empty).

The Mumble server is for the players to talk to each other; the voice chat is not on the stream. See [Mumble deployment (Unraid)](mumble.md).

## Watch the logs

```bash
docker compose logs -f minecraft-spectator-bot  # Bot logs
docker compose logs -f streaming-service        # Streaming logs
docker compose logs -f                          # All logs
```

With the published images, add `-f docker-compose.prod.yml` after `docker compose`. A working bot logs `Now following: <name>` when it picks a player, `No players online - pausing stream` when the server empties, and `Players detected - resuming stream` when someone joins.

## Update, restart, stop

With the published images:

```bash
git pull                                          # the new release's image tags
docker compose -f docker-compose.prod.yml pull    # fetch those images
docker compose -f docker-compose.prod.yml up -d   # recreate what changed
docker compose -f docker-compose.prod.yml restart # restart everything
docker compose -f docker-compose.prod.yml down    # stop; the sign-in volume stays
```

Built from this checkout: `git pull && docker compose up -d --build`. `docker compose down` without `-v` keeps the `minecraft-bot-auth` volume, so the bot does not need to sign in again.
