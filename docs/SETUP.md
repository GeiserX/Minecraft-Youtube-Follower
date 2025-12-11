# Setup Guide

## Prerequisites

1. **Minecraft Account**: Purchase a separate Minecraft Java Edition account for the bot (~$30)
2. **Unraid System**: With Docker support and Intel iGPU
3. **Minecraft Server**: Paper server (latest version) with GeyserMC for Bedrock support
4. **Streaming Key**: YouTube or Twitch streaming key

## Installation Steps

### 1. Clone the Repository

```bash
cd /mnt/user/appdata/
git clone https://github.com/yourusername/Minecraft-Youtube-Follower.git
cd Minecraft-Youtube-Follower
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Minecraft Bot Configuration
MINECRAFT_USERNAME=your_bot_username
MINECRAFT_PASSWORD=your_bot_password
SERVER_HOST=your_server_ip
SERVER_PORT=25565

# Streaming Configuration
YOUTUBE_STREAM_KEY=your_youtube_stream_key
STREAM_PLATFORM=youtube

# Audio Mixing
VOICE_VOLUME_GAIN=2.0
GAME_MUSIC_VOLUME_GAIN=0.5
```

### 3. Configure Showcase Locations

Edit `bot/spectator-bot.js` and add coordinates of interesting builds:

```javascript
const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
  { x: 100, y: 80, z: 200, description: 'Player Base 1' },
  { x: -150, y: 70, z: 300, description: 'Player Base 2' },
  // Add more locations...
];
```

### 4. Build and Start Services

```bash
docker-compose build
docker-compose up -d
```

### 5. Check Logs

```bash
# Bot logs
docker-compose logs -f minecraft-spectator-bot

# Streaming logs
docker-compose logs -f minecraft-streaming-service

# Voice server logs
docker-compose logs -f minecraft-mumble-server
```

### 6. Access Voice Chat

Open your browser and navigate to:
```
http://your-server-ip:8080
```

## Getting YouTube Streaming Key

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click "Go Live" → "Stream"
3. Copy your "Stream Key"
4. Add it to your `.env` file

## Getting Twitch Streaming Key

1. Go to [Twitch Creator Dashboard](https://dashboard.twitch.tv)
2. Settings → Stream
3. Copy your "Primary Stream Key"
4. Add it to your `.env` file

## Troubleshooting

### Bot Can't Connect

- Verify Minecraft credentials in `.env`
- Check server IP and port
- Ensure server allows the bot's IP address
- Check if server requires whitelist

### No Video Stream

- Verify streaming key is correct
- Check Intel iGPU passthrough: `ls -la /dev/dri/`
- Review streaming service logs
- Ensure spectator bot is running and in spectator mode

### Voice Chat Not Working

- Check voice server logs
- Verify port 8080 is accessible
- Test WebRTC connection in browser console
- Check microphone permissions in browser

### High CPU Usage

- Reduce stream quality in `streaming-service.py`
- Lower video bitrate
- Reduce number of showcase locations

## Performance Optimization

### For Lower-End Systems

Edit `docker-compose.yml`:

```yaml
streaming-service:
  environment:
    - DISPLAY_WIDTH=1280
    - DISPLAY_HEIGHT=720
```

Edit `streaming/streaming-service.py` to reduce bitrate:

```python
'-b:v', '2000k',  # Reduced from 3000k
```

## Maintenance

### Update Services

```bash
docker-compose pull
docker-compose build
docker-compose up -d
```

### Restart Services

```bash
docker-compose restart
```

### Stop Services

```bash
docker-compose down
```

## Security Notes

- Never commit `.env` file to git
- Use strong passwords for Minecraft account
- Keep streaming keys secret
- Consider firewall rules for voice server port


