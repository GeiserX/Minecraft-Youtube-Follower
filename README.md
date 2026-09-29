<p align="center"><img src="https://raw.githubusercontent.com/GeiserX/Minecraft-Youtube-Follower/main/docs/images/banner.svg" alt="Minecraft YouTube Follower banner" width="900"/></p>

<h1 align="center">Minecraft YouTube Follower</h1>

<p align="center">
  <a href="https://github.com/GeiserX/Minecraft-Youtube-Follower/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/GeiserX/Minecraft-Youtube-Follower/ci.yml?label=CI" alt="CI"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/GeiserX/Minecraft-Youtube-Follower" alt="License"/></a>
  <a href="https://hub.docker.com/r/drumsergio/minecraft-spectator-bot"><img src="https://img.shields.io/docker/pulls/drumsergio/minecraft-spectator-bot" alt="Docker Pulls"/></a>
  <a href="https://codecov.io/gh/GeiserX/Minecraft-Youtube-Follower"><img src="https://codecov.io/gh/GeiserX/Minecraft-Youtube-Follower/graph/badge.svg" alt="Codecov"/></a>
</p>

<p align="center"><strong>A Docker-based system for 24/7 automated streaming of your Minecraft server. The spectator bot follows players with a third-person camera, tours your builds when the server is empty, and streams everything to YouTube or Twitch.</strong></p>

Watch it live: [24/7 automated server stream](https://youtube.com/live/7pPMtL0e8eE) and [player following demo](https://youtube.com/live/9ns0jZ_VBC4).

## Features

- Mineflayer spectator bot that follows players and switches between them.
- Third-person camera that shows the player, looks at their face, and moves closer indoors and farther outdoors.
- 24/7 streaming to YouTube (RTMP or HLS) or Twitch, with Intel VAAPI hardware encoding when available.
- Player name overlay and background Minecraft music.
- Showcase mode that tours chosen builds when nobody is online.
- Mumble voice chat server for players.
- Fully containerized; code changes apply with a container restart, no image rebuild.

## Quick start

```bash
git clone https://github.com/GeiserX/Minecraft-Youtube-Follower.git && cd Minecraft-Youtube-Follower
cp env.example .env   # then edit .env
docker-compose -f docker-compose.prod.yml up -d
```

On first start, follow the device code link in `docker-compose logs -f minecraft-spectator-bot` to sign in the bot. You need a Minecraft Java Edition account, a free Azure subscription and a stream key; see [Installation](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/installation.md).

## Documentation

- [Installation](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/installation.md): requirements, deploy steps, server configuration
- [Setup guide](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/SETUP.md): complete installation and authentication guide
- [Mojang API approval](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/MOJANG_API_APPROVAL.md): required for new applications
- [Configuration](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/configuration.md): environment variables, showcase locations, music
- [Architecture](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/architecture.md): services and how a frame reaches the stream
- [Mumble on Unraid](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/mumble.md)
- [Development](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/development.md): live code updates, logs, rebuilding, contributing
- [Troubleshooting](https://github.com/GeiserX/Minecraft-Youtube-Follower/blob/main/docs/troubleshooting.md)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

This project is for educational and personal use. Follow Minecraft's Terms of Service, YouTube/Twitch streaming policies, your server's rules and regulations, and privacy laws if you stream other players.
