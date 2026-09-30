# How it works

<a href="https://hub.docker.com/r/drumsergio/minecraft-spectator-bot"><img src="https://img.shields.io/docker/image-size/drumsergio/minecraft-spectator-bot/latest" alt="Docker Image Size"/></a>

## Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view via Puppeteer and streams to YouTube/Twitch using FFmpeg
- **mumble-server**: Mumble VoIP server for player voice communication

## How It Works

1. Bot authenticates with Microsoft account (tokens cached in Docker volume)
2. Bot joins your Minecraft server in spectator mode
3. Bot detects active players from tab-list
4. Camera positions behind player, looking at their face
5. Spectator view rendered via prismarine-viewer web interface
6. Puppeteer captures the viewer in headless Chrome
7. FFmpeg encodes (with hardware acceleration if available) and streams
8. Player name overlay added to stream
9. When nobody is online, the bot marks the stream paused and the streaming service stops FFmpeg; it starts again when a player joins

## Features in detail

- 🤖 **Intelligent Spectator Bot**: Mineflayer bot that follows players with adaptive camera positioning
- 📹 **24/7 Streaming**: Continuous YouTube/Twitch streaming with hardware-accelerated encoding (Intel iGPU)
- 🎯 **Smart Camera System**: 
  - Third-person view that shows the player (not just their POV)
  - Always focuses on player's face, not feet
  - Smooth continuous tracking (configurable update rate)
- 🏷️ **Player Name Overlay**: Shows who's being followed on stream
- 🎵 **Background Music**: Plays Minecraft music during the stream
- ⏸️ **Pauses when empty**: Stops the stream when nobody is online and starts it again when a player joins
- 🎤 **Voice Chat Integration**: Mumble VoIP server for player communication
- 🐳 **Docker Native**: Fully containerized for easy deployment
- ⚡ **Live Code Updates**: Changes to the entry scripts apply without rebuilding Docker images
