# Minecraft YouTube Follower

A Docker-based system for 24/7 automated streaming of your Minecraft server with intelligent player following and integrated voice chat. The bot automatically follows players, showcases builds when the server is empty, and streams everything to YouTube or Twitch.

## Features

- 🤖 **Automated Spectator Bot**: Uses Mineflayer to follow players in spectator mode (noclip, invisible)
- 📹 **24/7 Streaming**: Continuous YouTube/Twitch streaming with optimized encoding
- 🎯 **Smart Player Tracking**: Automatically follows active players, switches every 30 seconds
- 🎬 **Smooth Following**: Uses `/spectate` command for first-person smooth camera movement
- 🏗️ **Base Showcase Mode**: Tours interesting builds when no players are online
- 🎤 **Voice Chat Integration**: Mumble VoIP server for player voice communication
- 🐳 **Docker Native**: Fully containerized for easy deployment
- ⚡ **Live Code Updates**: Code changes apply without rebuilding Docker images

## Requirements

- Docker and Docker Compose
- Minecraft Java Edition account for the bot (~$30)
- Free Azure subscription (for Microsoft account authentication)
- Minecraft server (Paper recommended, with ViaBackwards plugin for version compatibility)
- YouTube or Twitch streaming key
- Mojang API approval (required for new third-party applications)

## Quick Start

1. **Clone this repository**:
   ```bash
   git clone https://github.com/GeiserX/Minecraft-Youtube-Follower.git
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

4. **Authenticate** (first time only):
   - Check bot logs: `docker-compose logs minecraft-spectator-bot`
   - Follow the device code authentication link
   - Tokens are cached in a Docker volume (survives restarts)

## Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MINECRAFT_USERNAME` | Your Minecraft Java Edition username | `YourUsername` |
| `SERVER_HOST` | Your Minecraft server IP/domain | `mc.example.com` |
| `SERVER_PORT` | Minecraft server port | `25565` |
| `AZURE_CLIENT_ID` | Azure app registration client ID | `12345678-1234-1234-1234-123456789abc` |
| `YOUTUBE_STREAM_KEY` | YouTube streaming key (RTMP or HLS CID) | `your-stream-key` |
| `STREAM_PLATFORM` | Streaming platform | `youtube` or `twitch` |

### Bot Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_SPECTATE` | `true` | Use `/spectate` for smooth first-person following (recommended). Set to `false` for third-person camera with adaptive distance |
| `CHECK_INTERVAL_MS` | `5000` | How often to check for online players (milliseconds) |
| `SWITCH_INTERVAL_MS` | `30000` | How long to follow each player before switching (milliseconds) |
| `FOLLOW_DISTANCE` | `8` | Camera distance behind player (blocks, only used when `USE_SPECTATE=false`) |
| `FOLLOW_HEIGHT` | `3` | Camera height above player (blocks, only used when `USE_SPECTATE=false`) |
| `VIEWER_VIEW_DISTANCE` | `6` | Prismarine viewer render distance (lower = better performance) |
| `SPECTATOR_PORT` | `3000` | Port for the prismarine-viewer web interface |
| `MSAL_AUTHORITY` | `https://login.microsoftonline.com/consumers` | Azure AD authority. Use `https://login.microsoftonline.com/common` if you get tenant/consent errors |

### Streaming Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `YOUTUBE_INGEST_METHOD` | `rtmp` | YouTube ingest method: `rtmp` or `hls` |
| `YOUTUBE_HLS_URL` | (empty) | Full YouTube HLS ingest URL from Studio (recommended for HLS) |
| `YOUTUBE_HLS_HTTP_METHOD` | `PUT` | HTTP method for HLS uploads (`PUT` or `POST`) |
| `YOUTUBE_OUTPUT_WIDTH` | `1280` | Stream output width (pixels) |
| `YOUTUBE_OUTPUT_HEIGHT` | `720` | Stream output height (pixels) |
| `YOUTUBE_VIDEO_BITRATE` | `1500k` | Video bitrate (lower = smoother streaming, less CPU) |
| `YOUTUBE_MAXRATE` | `1500k` | Maximum video bitrate (should match `YOUTUBE_VIDEO_BITRATE` for CBR) |
| `YOUTUBE_BUFSIZE` | `3000k` | Video buffer size (typically 2x bitrate) |
| `YOUTUBE_FRAMERATE` | `24` | Stream framerate (24fps = smoother with less CPU) |
| `DISPLAY_WIDTH` | `1280` | Virtual display width (should match output for less scaling) |
| `DISPLAY_HEIGHT` | `720` | Virtual display height (should match output for less scaling) |
| `TWITCH_STREAM_KEY` | (empty) | Twitch streaming key (if using Twitch) |

### Mumble Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MUMBLE_PORT` | `64738` | Mumble server port |
| `MUMBLE_SUPERUSER_PASSWORD` | `changeme` | Mumble superuser password |
| `VOICE_VOLUME_GAIN` | `2.0` | Voice chat volume gain (multiplier) |
| `GAME_MUSIC_VOLUME_GAIN` | `0.5` | Game music volume gain (if implemented) |

### Advanced Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `YOUTUBE_INGEST_URL` | `rtmp://a.rtmp.youtube.com/live2` | YouTube RTMP ingest base URL |
| `YOUTUBE_HLS_UPLOAD_BASE` | `https://a.upload.youtube.com/http_upload_hls` | YouTube HLS upload base URL |
| `FOLLOW_UPDATE_INTERVAL_MS` | `2000` | How often to update camera position when not using `/spectate` (milliseconds) |

## Architecture

### Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view via Puppeteer and streams to YouTube/Twitch using FFmpeg
- **mumble-server**: Mumble VoIP server for player voice communication

### How It Works

1. Bot authenticates with Microsoft account (cached in Docker volume)
2. Bot joins your Minecraft server in spectator mode
3. Bot detects active players from tab-list (works even if players are far away)
4. Bot follows the most active player using `/spectate` (smooth first-person view)
5. Bot switches between players every 30 seconds (if multiple are active)
6. Spectator view is rendered via prismarine-viewer web interface
7. Puppeteer captures the viewer in a headless Chrome browser
8. FFmpeg encodes and streams to YouTube/Twitch
9. When no players are online, bot showcases interesting builds (configure in code)

## Getting Your YouTube Stream Key

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Navigate to **Content** → **Go live** → **Stream**
3. Create a new stream or use an existing one
4. Choose **RTMP** or **HLS** ingest method:
   - **RTMP**: Copy the stream key (format: `xxxx-xxxx-xxxx-xxxx-xxxx`)
   - **HLS**: Copy the full ingest URL (starts with `https://a.upload.youtube.com/http_upload_hls?...`)
5. Add to `.env`:
   - For RTMP: `YOUTUBE_STREAM_KEY=your-key` and `YOUTUBE_INGEST_METHOD=rtmp`
   - For HLS: `YOUTUBE_HLS_URL=your-full-url` and `YOUTUBE_INGEST_METHOD=hls`

## Viewing Your Stream

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Navigate to **Content** → **Go live**
3. Your stream should appear in the list
4. Click **Go live** to make it public
5. The stream URL will be: `https://www.youtube.com/watch?v=STREAM_ID`

**Note**: YouTube may show "Preparando emisión" (preparing broadcast) for a minute while processing HLS segments. This is normal.

## Server Configuration

Your Minecraft server needs:

1. **ViaBackwards plugin** (for version compatibility):
   - Download: https://github.com/ViaVersion/ViaBackwards
   - Place in `plugins/` folder
   - Allows bot (1.21.4 protocol) to connect to server (1.21.10)

2. **Bot permissions**:
   ```bash
   /whitelist add <bot_username>
   /op <bot_username>
   ```

3. **Server settings**:
   - `online-mode=true` (required for Microsoft authentication)
   - Whitelist enabled (if using whitelist)

See [docs/SERVER_CONFIGURATION.md](docs/SERVER_CONFIGURATION.md) for detailed server setup.

## Authentication Setup

**⚠️ IMPORTANT**: Microsoft accounts require OAuth authentication and Mojang API approval. This is a multi-step process:

1. **Azure App Registration** - Required for Microsoft OAuth
2. **Mojang API Approval** - Required for new third-party applications

See [docs/SETUP.md](docs/SETUP.md) for the complete step-by-step authentication guide.

## Troubleshooting

### Authentication Issues

- **"first party application" error**: Try setting `MSAL_AUTHORITY=https://login.microsoftonline.com/common` in `.env`
- **"Mojang API approval required"**: You must request approval from Mojang (see [docs/SETUP.md](docs/SETUP.md))
- **Tokens not persisting**: Check that the `minecraft-bot-auth` Docker volume exists

### Bot Won't Connect

- Verify server IP and port in `.env`
- Check server allows the bot's IP address
- Ensure server doesn't require whitelist (or bot is whitelisted)
- Check server has ViaBackwards plugin installed
- Verify bot has OP permissions

### No Video Stream

- Verify streaming key is correct
- Check streaming service logs: `docker-compose logs streaming-service`
- Ensure spectator bot viewer is accessible: `docker-compose logs minecraft-spectator-bot`
- Check YouTube Studio shows "Streaming" status
- For HLS: Wait 1-2 minutes for YouTube to process segments

### Stream is Black

- Check Puppeteer logs: `docker-compose logs streaming-service | grep Puppeteer`
- Verify Chromium window exists: The service auto-restarts if window disappears
- Check viewer is accessible: `curl http://localhost:3000` (from host)

### Bot Not Following Players

- Check bot logs: `docker-compose logs minecraft-spectator-bot`
- Verify players are online (bot logs show "Players online (N): ...")
- Check `/spectate` command is available on your server
- If using third-person mode (`USE_SPECTATE=false`), ensure bot has OP permissions

## Development

### Live Code Updates

Code changes apply without rebuilding Docker images:

- `bot/spectator-bot.js` - Mounted as volume (changes apply on container restart)
- `streaming/capture-viewer.js` - Mounted as volume
- `streaming/streaming-service.py` - Mounted as volume

To apply changes:
```bash
docker-compose restart minecraft-spectator-bot  # For bot changes
docker-compose restart streaming-service        # For streaming changes
```

### Logs

```bash
# Bot logs
docker-compose logs -f minecraft-spectator-bot

# Streaming service logs
docker-compose logs -f streaming-service

# All logs
docker-compose logs -f
```

### Rebuilding Images

If you change dependencies (`package.json`, `requirements.txt`, or `Dockerfile`):

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Documentation

- [Setup Guide](docs/SETUP.md) - Complete installation and authentication guide
- [Server Configuration](docs/SERVER_CONFIGURATION.md) - Minecraft server setup
- [YouTube Streaming](docs/YOUTUBE_STREAMING.md) - YouTube streaming setup details

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is for educational and personal use. Ensure you comply with:

- Minecraft's Terms of Service
- YouTube/Twitch streaming policies
- Your server's rules and regulations
- Privacy laws (if streaming other players)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

**GeiserX** - [@GeiserX](https://github.com/GeiserX)
