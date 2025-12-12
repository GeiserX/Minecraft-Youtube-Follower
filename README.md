# Minecraft YouTube Follower

A Docker-based system for 24/7 automated streaming of your Minecraft server with intelligent player following, dynamic split-screen views, and integrated voice chat.

## Features

- 🤖 **Automated Spectator Bot**: Uses Mineflayer to follow players in spectator mode (noclip, invisible)
- 📹 **24/7 Streaming**: Continuous YouTube/Twitch streaming with Intel iGPU hardware acceleration
- 🎯 **Smart Player Tracking**: Automatically follows the most active player, switches every 30 seconds
- 🎬 **Dynamic Split-Screen**: Automatically adjusts layout based on player count (1-4 players)
- 🏗️ **Base Showcase Mode**: Tours interesting builds when no players are online
- 🎤 **Voice Chat Integration**: Mumble VoIP server for player voice communication, mixed into stream
- 🐳 **Docker Native**: Fully containerized for easy deployment on Unraid

## Requirements

- Docker and Docker Compose
- Minecraft Java Edition account for the bot (~$30)
- Free Azure subscription (for Microsoft account authentication)
- Minecraft server (Paper recommended)
- YouTube or Twitch streaming key
- Intel iGPU recommended (for hardware-accelerated encoding on Linux)

## Quick Start

1. **Clone this repository**:
   ```bash
   git clone https://github.com/yourusername/Minecraft-Youtube-Follower.git
   cd Minecraft-Youtube-Follower
   ```

2. **Set up authentication** (see [docs/SETUP.md](docs/SETUP.md) for complete guide):
   - Get free Azure subscription
   - Create Azure app registration
   - Request Mojang API approval (required for new apps)
   - Configure `.env` file

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

## Authentication Setup

**⚠️ IMPORTANT**: Microsoft accounts require OAuth authentication and Mojang API approval. This is a multi-step process:

1. **Azure App Registration** - Required for Microsoft OAuth
2. **Mojang API Approval** - Required for new third-party applications

See [docs/SETUP.md](docs/SETUP.md) for the complete step-by-step authentication guide.

## Configuration

Copy `.env.example` to `.env` and configure:

- `MINECRAFT_USERNAME` - Your Minecraft Java Edition username
- `SERVER_HOST` - Your Minecraft server IP/domain
- `AZURE_CLIENT_ID` - From Azure app registration
- `YOUTUBE_STREAM_KEY` or `TWITCH_STREAM_KEY` - Your streaming key
- `STREAM_PLATFORM` - `youtube` or `twitch`

See [docs/SETUP.md](docs/SETUP.md) for all configuration options.

## Architecture

### Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view and streams to YouTube/Twitch using FFmpeg
- **mumble-server**: Mumble VoIP server for player voice communication

### How It Works

1. Bot joins your Minecraft server in spectator mode
2. Bot detects active players and follows the most active one
3. Bot switches between players every 30 seconds (if multiple are active)
4. Spectator view is captured via prismarine-viewer web interface
5. FFmpeg encodes and streams to YouTube/Twitch
6. Voice chat audio is mixed into the stream
7. When no players are online, bot showcases interesting builds

## Documentation

- [Setup Guide](docs/SETUP.md) - Complete installation and authentication guide
- [Mojang API Approval](docs/MOJANG_API_APPROVAL.md) - How to request API access
- [Voice Server](docs/VOICE_SERVER.md) - Voice chat implementation details
- [Implementation Notes](docs/IMPLEMENTATION_NOTES.md) - Technical architecture details

## Troubleshooting

### Authentication Issues
- See [docs/SETUP.md](docs/SETUP.md) for authentication troubleshooting
- Most common: Missing Mojang API approval or incorrect Azure app configuration

### Bot Won't Connect
- Verify server IP and port in `.env`
- Check server allows the bot's IP address
- Ensure server doesn't require whitelist

### No Video Stream
- Verify streaming key is correct
- Check streaming service logs: `docker-compose logs minecraft-streaming-service`
- Ensure spectator bot viewer is accessible

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is for educational and personal use. Ensure you comply with:
- Minecraft's Terms of Service
- YouTube/Twitch streaming policies
- Your server's rules and regulations
