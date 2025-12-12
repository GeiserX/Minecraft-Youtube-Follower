# Complete Setup Guide

## Prerequisites

1. **Minecraft Account**: Purchase a separate Minecraft Java Edition account for the bot (~$30)
2. **Docker**: Docker and Docker Compose installed
3. **Minecraft Server**: Paper server (latest version) recommended
4. **Streaming Key**: YouTube or Twitch streaming key
5. **Free Azure Subscription**: Required for Microsoft account authentication

## Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/Minecraft-Youtube-Follower.git
cd Minecraft-Youtube-Follower
```

## Step 2: Azure App Registration

**⚠️ REQUIRED**: Microsoft accounts require OAuth authentication via Azure app registration.

### 2.1: Get Azure Subscription (Free)

Personal Microsoft accounts need a free Azure subscription:

1. Go to: https://azure.microsoft.com/free/
2. Click **"Start free"**
3. Sign up with your Microsoft account
4. Verify phone number (credit card required for verification only - no charges)

### 2.2: Create App Registration

1. Go to: https://portal.azure.com
2. Search **"Azure Active Directory"** → Click on it
3. Click **"App registrations"** in the left menu
4. Click **"New registration"**
5. Fill in:
   - **Name**: `MinecraftBot` (or any name)
   - **Supported account types**: **"Accounts in any organizational directory and personal Microsoft accounts (e.g. Skype, Xbox)"**
   - Leave redirect URI empty
6. Click **"Register"**
7. Copy the **"Application (client) ID"** (a long GUID)

### 2.3: Configure App

**Enable Public Client Flows**:
1. Click **"Authentication"** in the left menu
2. Scroll to **"Advanced settings"**
3. Set **"Allow public client flows"** to **"Yes"**
4. Click **"Save"**

**Note**: Xbox Live API permission is not available in standard Azure registrations and may not be required.

## Step 3: Request Mojang API Approval

**⚠️ CRITICAL**: Mojang requires all new third-party applications to be manually approved before accessing Minecraft Java Edition APIs.

1. Go to: https://help.minecraft.net/
2. Search for "Java Edition Game Service API Review" or "API integration request"
3. Find and fill out the application form
4. Provide:
   - Application name: MinecraftBot
   - Purpose: Automated spectator bot for streaming
   - Azure Client ID: `your-client-id-here`
   - Description: Automated bot that follows players in spectator mode for 24/7 YouTube/Twitch streaming
5. Submit and wait for Mojang approval (may take days/weeks)

See [MOJANG_API_APPROVAL.md](MOJANG_API_APPROVAL.md) for detailed instructions.

## Step 4: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Minecraft Bot Configuration
MINECRAFT_USERNAME=your_bot_username
SERVER_HOST=your_server_ip
SERVER_PORT=25565
SPECTATOR_PORT=3000

# Azure Authentication
AZURE_CLIENT_ID=your-azure-client-id-here

# Streaming Configuration
STREAM_PLATFORM=youtube
YOUTUBE_STREAM_KEY=your_youtube_stream_key
# OR for Twitch:
# TWITCH_STREAM_KEY=your_twitch_stream_key

# Display Settings
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080

# Audio Mixing
VOICE_VOLUME_GAIN=2.0
GAME_MUSIC_VOLUME_GAIN=0.5

# Mumble Server
MUMBLE_PORT=64738
MUMBLE_SUPERUSER_PASSWORD=changeme
```

## Step 5: Configure Showcase Locations (Optional)

Edit `bot/spectator-bot.js` and add coordinates of interesting builds:

```javascript
const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
  { x: 100, y: 80, z: 200, description: 'Player Base 1' },
  { x: -150, y: 70, z: 300, description: 'Player Base 2' },
  // Add more locations...
];
```

## Step 6: Build and Start Services

```bash
docker-compose build
docker-compose up -d
```

## Step 7: Complete Device Code Authentication

**After Mojang approval**, complete one-time authentication:

1. Check logs: `docker-compose logs -f minecraft-spectator-bot`
2. The bot will display a device code like: `To sign in, use a web browser to open the page https://www.microsoft.com/link and enter the code ABC123XYZ`
3. Go to: https://www.microsoft.com/link
4. Enter the code shown
5. Sign in with your Microsoft account
6. Grant permissions if prompted

**Note**: This is a **one-time setup**. After authentication, tokens are cached and the bot will connect automatically on future restarts.

## Getting Streaming Keys

### YouTube Streaming Key

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Click "Go Live" → "Stream"
3. Copy your "Stream Key"
4. Add it to your `.env` file

### Twitch Streaming Key

1. Go to [Twitch Creator Dashboard](https://dashboard.twitch.tv)
2. Settings → Stream
3. Copy your "Primary Stream Key"
4. Add it to your `.env` file

## Troubleshooting

### Authentication Issues

**"Invalid app registration"**:
- Most likely: Missing Mojang API approval (see Step 3)
- Or: Azure app not configured correctly (check Step 2.3)

**"Account does not exist in tenant"**:
- Azure app registered with wrong account type
- Solution: Re-register with "Accounts in any organizational directory and personal Microsoft accounts"

**"invalid_grant"**:
- Public client flows not enabled
- Solution: Enable "Allow public client flows" in Azure app Authentication settings

### Bot Can't Connect

- Verify `SERVER_HOST` and `SERVER_PORT` in `.env`
- Check server allows the bot's IP address
- Ensure server doesn't require whitelist
- Check bot logs: `docker-compose logs minecraft-spectator-bot`

### No Video Stream

- Verify streaming key is correct
- Check streaming service logs: `docker-compose logs minecraft-streaming-service`
- Ensure spectator bot viewer is accessible at http://localhost:3000
- Check Intel iGPU passthrough (Linux): `ls -la /dev/dri/`

### Voice Chat Not Working

- Check Mumble server logs: `docker-compose logs minecraft-mumble-server`
- Verify port 64738 is accessible
- Test with Mumble client: connect to `localhost:64738`

### High CPU Usage

- Reduce stream quality in `docker-compose.yml`:
  ```yaml
  DISPLAY_WIDTH=1280
  DISPLAY_HEIGHT=720
  ```
- Lower video bitrate in `streaming/streaming-service.py`:
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

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f minecraft-spectator-bot
docker-compose logs -f minecraft-streaming-service
docker-compose logs -f minecraft-mumble-server
```

## Security Notes

- Never commit `.env` file to git (already in .gitignore)
- Keep streaming keys secret
- Use strong password for Mumble superuser
- Tokens are stored in `./bot/config/.auth` (never commit this)
- Consider firewall rules for exposed ports
