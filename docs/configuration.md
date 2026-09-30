# Configuration

All configuration is done via environment variables. Copy `.env.example` to `.env` and customize. Both compose files read `.env`.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MINECRAFT_USERNAME` | Your Minecraft Java Edition username | `YourBotAccount` |
| `SERVER_HOST` | Your Minecraft server IP/domain | `mc.example.com` |
| `SERVER_PORT` | Minecraft server port | `25565` |
| `AZURE_CLIENT_ID` | Azure app registration client ID | `12345678-1234-1234-1234-123456789abc` |
| `YOUTUBE_STREAM_KEY` | YouTube streaming key | `xxxx-xxxx-xxxx-xxxx-xxxx` |

## Camera Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMERA_MODE` | `third-person` | Camera mode: `third-person` (shows player) or `spectate` (first-person POV) |
| `CAMERA_UPDATE_INTERVAL_MS` | `2000` | Camera position update rate in ms (lower = smoother but more commands) |
| `CAMERA_DISTANCE` | `8` | How far behind the player the camera floats (in blocks) |
| `CAMERA_HEIGHT` | `4` | How high above the player's feet the camera floats (in blocks) |
| `CAMERA_FIXED_ANGLE` | `0` | Fixed horizontal angle relative to player (degrees, 0=behind, 90=left side) |
| `CHECK_INTERVAL_MS` | `5000` | How often to check for players (ms) |
| `SWITCH_INTERVAL_MS` | `30000` | How long to follow each player before switching (ms) |
| `SHOWCASE_DURATION_MS` | `10000` | Read but has no effect since v0.5.4; see [When the server is empty](#when-the-server-is-empty) |

Both compose files read these from `.env` and fall back to the defaults above when a variable is unset.

**CAMERA_DISTANCE vs VIEWER_VIEW_DISTANCE:**
- `CAMERA_DISTANCE` = How many blocks behind the player the camera is positioned
- `VIEWER_VIEW_DISTANCE` = How many chunks (16x16 block areas) are rendered in the viewer

## Streaming Configuration

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
| `ENCODER_PRESET` | `faster` | x264 speed/quality tradeoff (see below) |

**ENCODER_PRESET Options** (from fastest to slowest):
| Preset | CPU Usage | Quality | Recommended For |
|--------|-----------|---------|-----------------|
| `ultrafast` | Lowest | Poorest | Weak CPUs, testing |
| `superfast` | Very Low | Poor | Low-end systems |
| `veryfast` | Low | Below Average | Budget systems |
| `faster` | Below Average | Good | **Default** - balanced |
| `fast` | Average | Very Good | Mid-range systems |
| `medium` | Above Average | Excellent | Powerful systems |
| `slow` | High | Best | When quality is priority |

## Overlay & Music

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_OVERLAY` | `true` | Show player name overlay (e.g., "Now following: PlayerName") |
| `OVERLAY_FONT_SIZE` | `28` | Overlay font size (pixels) - doubled internally for visibility |
| `OVERLAY_POSITION` | `top-left` | Position: `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| `ENABLE_MUSIC` | `true` | Play background music |
| `MUSIC_VOLUME` | `0.15` | Music volume (0.0-1.0) - keep low if using voice chat |

## Performance Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `VIEWER_VIEW_DISTANCE` | `6` | Prismarine viewer render distance (lower = better performance) |
| `DISPLAY_WIDTH` | `1280` | Virtual display width (should match output) |
| `DISPLAY_HEIGHT` | `720` | Virtual display height (should match output) |

## Voice Chat (Mumble)

| Variable | Default | Description |
|----------|---------|-------------|
| `MUMBLE_PORT` | `64738` | Mumble server port |
| `MUMBLE_SUPERUSER_PASSWORD` | `changeme` | Mumble admin password |

## When the server is empty

When nobody is online, the bot writes "Server empty - stream paused" to the overlay and tells the streaming service to stop FFmpeg, so nothing is sent to YouTube or Twitch. The bot checks the player list every `CHECK_INTERVAL_MS` and starts the stream again when a player joins. This has been the behaviour since v0.5.4; the showcase tour that earlier versions ran instead is no longer started, so `SHOWCASE_DURATION_MS` and the showcase locations in `bot/bot-logic.js` have no effect.

## Adding Minecraft music

Place `.ogg` or `.mp3` files in `streaming/music/`:

```bash
# From your Minecraft installation
cp ~/.minecraft/assets/objects/**/**.ogg streaming/music/

# Or download from Minecraft Wiki
# https://minecraft.wiki/w/Music
```

Music loops seamlessly through all files in the directory.
