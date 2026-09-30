<p align="center"><img src="https://raw.githubusercontent.com/GeiserX/Minecraft-Youtube-Follower/main/docs/images/banner.svg" alt="Minecraft YouTube Follower" width="900"/></p>

<h1 align="center">Minecraft YouTube Follower</h1>

<p align="center">
  <a href="https://github.com/GeiserX/Minecraft-Youtube-Follower/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GeiserX/Minecraft-Youtube-Follower/ci.yml?label=CI" alt="CI"/></a>
  <a href="https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GeiserX/Minecraft-Youtube-Follower" alt="License"/></a>
  <a href="https://hub.docker.com/r/drumsergio/minecraft-spectator-bot"><img src="https://img.shields.io/docker/pulls/drumsergio/minecraft-spectator-bot" alt="Docker Pulls"/></a>
  <a href="https://codecov.io/gh/GeiserX/Minecraft-Youtube-Follower"><img src="https://codecov.io/gh/GeiserX/Minecraft-Youtube-Follower/graph/badge.svg" alt="Codecov"/></a>
</p>

<p align="center"><strong>A Docker-based system for 24/7 automated streaming of your Minecraft server. The spectator bot follows players with a third-person camera and streams them to YouTube or Twitch whenever someone is online.</strong></p>

Watch it live: [24/7 automated server stream](https://youtube.com/live/7pPMtL0e8eE) and [player following demo](https://youtube.com/live/9ns0jZ_VBC4).

## Features

- Mineflayer spectator bot that follows players and switches between them.
- Third-person camera that stays behind and above the player and looks at their face.
- 24/7 streaming to YouTube (RTMP or HLS) or Twitch, with Intel VAAPI hardware encoding when available.
- Player name overlay and background Minecraft music.
- Stops the stream when the server is empty and starts it again when a player joins.
- Mumble voice chat server for players.
- Fully containerized; changes to the entry scripts apply with a container restart.

## Quick start

```bash
git clone https://github.com/GeiserX/Minecraft-Youtube-Follower.git && cd Minecraft-Youtube-Follower
cp .env.example .env   # then edit .env
docker compose -f docker-compose.prod.yml up -d
```

On first start, follow the device code link in `docker compose -f docker-compose.prod.yml logs -f minecraft-spectator-bot` to sign in the bot. You need a Minecraft Java Edition account, a free Azure subscription and a stream key; see [Getting started](https://geiserx.github.io/Minecraft-Youtube-Follower/getting-started/).

## Documentation

The docs are at [geiserx.github.io/Minecraft-Youtube-Follower](https://geiserx.github.io/Minecraft-Youtube-Follower/).

- [Getting started](https://geiserx.github.io/Minecraft-Youtube-Follower/getting-started/): requirements, Azure app registration, first start and the device-code sign-in
- [Mojang API approval](https://geiserx.github.io/Minecraft-Youtube-Follower/mojang-api-approval/): required before a new Azure app can sign a bot in
- [Usage](https://geiserx.github.io/Minecraft-Youtube-Follower/usage/): what the stream shows, the logs, updating and stopping
- [Configuration](https://geiserx.github.io/Minecraft-Youtube-Follower/configuration/): environment variables and music
- [Mumble deployment (Unraid)](https://geiserx.github.io/Minecraft-Youtube-Follower/mumble/): running the voice server on its own
- [How it works](https://geiserx.github.io/Minecraft-Youtube-Follower/how-it-works/): services and how a frame reaches the stream
- [Troubleshooting](https://geiserx.github.io/Minecraft-Youtube-Follower/troubleshooting/): sign-in, camera, stream and voice chat problems
- [Development](https://geiserx.github.io/Minecraft-Youtube-Follower/development/): live code updates, tests, rebuilding

## Disclaimer

This project is for educational and personal use. Follow Minecraft's Terms of Service, YouTube/Twitch streaming policies, your server's rules and regulations, and privacy laws if you stream other players.

## License

[GPL-3.0-or-later](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/LICENSE)
