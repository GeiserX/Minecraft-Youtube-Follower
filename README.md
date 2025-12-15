# Minecraft YouTube Follower

A Docker-based system for 24/7 automated streaming of your Minecraft server. The spectator bot automatically follows players with a smart third-person camera, showcases builds when the server is empty, and streams everything to YouTube or Twitch.

## Features

- 🤖 **Intelligent Spectator Bot**: Mineflayer bot that follows players with adaptive camera positioning
- 📹 **24/7 Streaming**: Continuous YouTube/Twitch streaming with hardware-accelerated encoding (Intel iGPU)
- 🎯 **Smart Camera System**: 
  - Third-person view that shows the player (not just their POV)
  - Adaptive distance based on environment (closer indoors, farther outdoors)
  - Always focuses on player's face, not feet
  - Smooth continuous tracking (configurable update rate)
- 🏷️ **Player Name Overlay**: Shows who's being followed on stream
- 🎵 **Background Music**: Plays Minecraft music during the stream
- 🏗️ **Base Showcase Mode**: Tours interesting builds when no players are online
- 🎤 **Voice Chat Integration**: Mumble VoIP server for player communication
- 🐳 **Docker Native**: Fully containerized for easy deployment
- ⚡ **Live Code Updates**: Code changes apply without rebuilding Docker images

## Requirements

- Docker and Docker Compose
- Minecraft Java Edition account for the bot (~$30)
- Free Azure subscription (for Microsoft account authentication)
- Minecraft server (Paper recommended, with ViaBackwards plugin)
- YouTube or Twitch streaming key
- (Optional) Intel iGPU for hardware-accelerated encoding

## Quick Start

1. **Clone this repository**:
   ```bash
   git clone https://github.com/GeiserX/Minecraft-Youtube-Follower.git
   cd Minecraft-Youtube-Follower
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

3. **Deploy** (development with local builds):
   ```bash
   docker-compose up -d
   ```

   Or **deploy with pre-built images** (production):
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Authenticate** (first time only):
   ```bash
   docker-compose logs -f minecraft-spectator-bot
   ```
   Follow the device code authentication link shown in logs.

## Configuration

All configuration is done via environment variables. Copy `env.example` to `.env` and customize.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MINECRAFT_USERNAME` | Your Minecraft Java Edition username | `YourBotAccount` |
| `SERVER_HOST` | Your Minecraft server IP/domain | `mc.example.com` |
| `SERVER_PORT` | Minecraft server port | `25565` |
| `AZURE_CLIENT_ID` | Azure app registration client ID | `12345678-1234-1234-1234-123456789abc` |
| `YOUTUBE_STREAM_KEY` | YouTube streaming key | `xxxx-xxxx-xxxx-xxxx-xxxx` |

### Camera Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMERA_MODE` | `third-person` | Camera mode: `third-person` (shows player) or `spectate` (first-person POV) |
| `CAMERA_UPDATE_INTERVAL_MS` | `500` | Camera position update rate (lower = smoother, more CPU) |
| `CAMERA_DISTANCE` | `6` | Base distance behind player (blocks) |
| `CAMERA_HEIGHT` | `2` | Base height above player's head (blocks) |
| `CAMERA_ANGLE_OFFSET` | `0` | Horizontal angle offset (degrees) |
| `CHECK_INTERVAL_MS` | `5000` | How often to check for players (ms) |
| `SWITCH_INTERVAL_MS` | `30000` | How long to follow each player before switching (ms) |

### Streaming Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAM_PLATFORM` | `youtube` | Platform: `youtube` or `twitch` |
| `YOUTUBE_INGEST_METHOD` | `rtmp` | Ingest method: `rtmp` or `hls` |
| `YOUTUBE_HLS_URL` | (empty) | Full YouTube HLS ingest URL (for HLS method) |
| `YOUTUBE_OUTPUT_WIDTH` | `1280` | Output resolution width |
| `YOUTUBE_OUTPUT_HEIGHT` | `720` | Output resolution height |
| `YOUTUBE_VIDEO_BITRATE` | `2500k` | Video bitrate |
| `YOUTUBE_FRAMERATE` | `30` | Stream framerate |
| `USE_HARDWARE_ENCODING` | `true` | Use Intel VAAPI if available |
| `ENCODER_PRESET` | `faster` | x264 preset (ultrafast/superfast/veryfast/faster/fast) |

### Overlay & Music

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_OVERLAY` | `true` | Show player name overlay |
| `OVERLAY_FONT_SIZE` | `24` | Overlay font size (pixels) |
| `OVERLAY_POSITION` | `top-left` | Position: `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| `ENABLE_MUSIC` | `true` | Play background music |
| `MUSIC_VOLUME` | `0.3` | Music volume (0.0-1.0) |

### Performance Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `VIEWER_VIEW_DISTANCE` | `6` | Prismarine viewer render distance (lower = better performance) |
| `DISPLAY_WIDTH` | `1280` | Virtual display width (should match output) |
| `DISPLAY_HEIGHT` | `720` | Virtual display height (should match output) |

### Voice Chat (Mumble)

| Variable | Default | Description |
|----------|---------|-------------|
| `MUMBLE_PORT` | `64738` | Mumble server port |
| `MUMBLE_SUPERUSER_PASSWORD` | `changeme` | Mumble admin password |

## Architecture

### Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view via Puppeteer and streams to YouTube/Twitch using FFmpeg
- **mumble-server**: Mumble VoIP server for player voice communication

### How It Works

1. Bot authenticates with Microsoft account (tokens cached in Docker volume)
2. Bot joins your Minecraft server in spectator mode
3. Bot detects active players from tab-list
4. Camera positions behind player, looking at their face
5. Camera adapts distance based on environment (closer indoors)
6. Spectator view rendered via prismarine-viewer web interface
7. Puppeteer captures the viewer in headless Chrome
8. FFmpeg encodes (with hardware acceleration if available) and streams
9. Player name overlay added to stream
10. When no players online, bot showcases pre-configured locations

## Mumble Deployment (Unraid)

For Unraid users who want to run Mumble separately:

### Option 1: Using Community Applications

1. Open **Community Applications** in Unraid
2. Search for "Mumble" or "Murmur"
3. Install the **mumble-server** container
4. Configure:
   - **Port**: 64738 (TCP and UDP)
   - **SuperUser Password**: Set a secure password
   - **Config Path**: `/mnt/user/appdata/mumble`

### Option 2: Docker Command

```bash
docker run -d \
  --name=mumble-server \
  -p 64738:64738/tcp \
  -p 64738:64738/udp \
  -e MUMBLE_SUPERUSER_PASSWORD=your_secure_password \
  -v /mnt/user/appdata/mumble:/data \
  --restart=unless-stopped \
  mumblevoip/mumble-server:latest
```

### Option 3: Docker Compose (Standalone)

Create `mumble-docker-compose.yml`:

```yaml
services:
  mumble-server:
    image: mumblevoip/mumble-server:latest
    container_name: mumble-server
    ports:
      - "64738:64738/tcp"
      - "64738:64738/udp"
    environment:
      - MUMBLE_SUPERUSER_PASSWORD=your_secure_password
    volumes:
      - /mnt/user/appdata/mumble:/data
    restart: unless-stopped
```

Then: `docker-compose -f mumble-docker-compose.yml up -d`

### Connecting Mumble to the Stream

1. Install Mumble client on your PC
2. Connect to your Unraid server IP on port 64738
3. The streaming service captures Mumble audio automatically (when voice integration is enabled)

## Adding Minecraft Music

Place `.ogg` or `.mp3` files in `streaming/music/`:

```bash
# From your Minecraft installation
cp ~/.minecraft/assets/objects/**/**.ogg streaming/music/

# Or download from Minecraft Wiki
# https://minecraft.wiki/w/Music
```

Music loops seamlessly through all files in the directory.

## Server Configuration

Your Minecraft server needs:

1. **ViaBackwards plugin** (for version compatibility):
   - Download: https://github.com/ViaVersion/ViaBackwards
   - Allows bot to connect regardless of version differences

2. **Bot permissions**:
   ```bash
   /whitelist add <bot_username>
   /op <bot_username>
   ```

3. **Server settings**:
   - `online-mode=true` (required for Microsoft authentication)

## Development

### Live Code Updates

Code changes apply without rebuilding:

- `bot/spectator-bot.js` - Restart bot container
- `streaming/capture-viewer.js` - Restart streaming container
- `streaming/streaming-service.py` - Restart streaming container

```bash
docker-compose restart minecraft-spectator-bot  # For bot changes
docker-compose restart streaming-service        # For streaming changes
```

### Logs

```bash
docker-compose logs -f minecraft-spectator-bot  # Bot logs
docker-compose logs -f streaming-service        # Streaming logs
docker-compose logs -f                          # All logs
```

### Rebuilding Images

For dependency changes:

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Authentication Issues

- **"first party application" error**: Set `MSAL_AUTHORITY=https://login.microsoftonline.com/common`
- **Tokens not persisting**: Check the `minecraft-bot-auth` Docker volume exists
- **Multiple auth codes**: Wait for authentication to complete before restarting

### Camera Issues

- **Camera too close**: Increase `CAMERA_DISTANCE` (default: 6)
- **Camera clipping through walls**: This is adaptive; ensure `CAMERA_MODE=third-person`
- **Jerky movement**: Decrease `CAMERA_UPDATE_INTERVAL_MS` (default: 500)

### Stream Issues

- **Black screen**: Check Puppeteer logs, ensure viewer is accessible
- **Low bitrate warning**: Increase `YOUTUBE_VIDEO_BITRATE`
- **High CPU usage**: Enable `USE_HARDWARE_ENCODING=true` (requires Intel iGPU)

### Bot Issues

- **"No players detected"**: Bot reads from tab-list; ensure players are actually online
- **Bot not moving**: Check bot has OP permissions on server

## Documentation

- [Setup Guide](docs/SETUP.md) - Complete installation and authentication guide
- [Mojang API Approval](docs/MOJANG_API_APPROVAL.md) - Required for new applications

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
