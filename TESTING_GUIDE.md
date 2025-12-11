# Local Testing Guide

## Prerequisites

1. **Docker Desktop** installed and running
2. **.env file** created with your configuration (see `.env.example`)
3. **Minecraft server** accessible at your configured host

## Quick Start

### 1. Create .env File

```powershell
# Copy the example
Copy-Item .env.example .env

# Edit .env with your values:
# - MINECRAFT_USERNAME=your_username
# - SERVER_HOST=your-server.com
# - YOUTUBE_STREAM_KEY=your_key_here
```

### 2. Run Test Script

```powershell
.\test-windows.ps1
```

Or manually:

```powershell
docker-compose up
```

## What to Expect

### First Run - Microsoft Authentication

When the bot starts for the first time, you'll see:

```
============================================================
MICROSOFT ACCOUNT AUTHENTICATION REQUIRED
============================================================
Go to: https://microsoft.com/devicelogin
Enter code: ABC123XYZ
============================================================
```

**Action Required:**
1. Open the URL in your browser
2. Enter the code shown
3. Sign in with your Microsoft account
4. Tokens will be cached for future runs

### Services Starting

1. **Bot Service**: Connects to Minecraft server
2. **Mumble Server**: Starts on port 64738
3. **Streaming Service**: Waits for viewer, then starts streaming

### Access Points

- **Viewer**: http://localhost:3000 (bot's perspective)
- **Mumble Server**: localhost:64738
- **Stream**: YouTube/Twitch (based on your .env)

## Testing Checklist

### ✅ Bot Connection
- [ ] Bot connects to server
- [ ] Microsoft authentication completes
- [ ] Bot switches to spectator mode
- [ ] Viewer accessible at http://localhost:3000

### ✅ Viewer
- [ ] Viewer page loads
- [ ] Shows Minecraft world
- [ ] Updates when bot follows players

### ✅ Mumble Server
- [ ] Mumble server starts
- [ ] Can connect with Mumble client
- [ ] Voice chat works

### ✅ Streaming
- [ ] FFmpeg process starts
- [ ] Stream appears on YouTube/Twitch
- [ ] Video quality acceptable
- [ ] Audio works (if implemented)

## Troubleshooting

### Bot Won't Connect
- Check SERVER_HOST and SERVER_PORT in .env
- Verify server is accessible
- Check firewall rules

### Viewer Not Loading
- Check bot logs: `docker-compose logs minecraft-spectator-bot`
- Verify port 3000 is not in use
- Check http://localhost:3000 in browser

### Streaming Fails
- Check YouTube/Twitch stream key
- Verify FFmpeg can access display
- Check streaming service logs: `docker-compose logs minecraft-streaming-service`

### Mumble Issues
- Check Mumble server logs: `docker-compose logs minecraft-mumble-server`
- Verify port 64738 is not in use
- Test with Mumble client: connect to localhost:64738

## Windows-Specific Notes

- **No iGPU passthrough**: Software encoding will be used (slower)
- **Audio capture**: May need virtual audio cable for full audio mixing
- **X11 display**: Limited on Windows, may need alternative capture method

## Next Steps After Testing

Once local testing passes:
1. Deploy to Unraid
2. Enable iGPU passthrough for hardware encoding
3. Configure proper audio routing
4. Set up monitoring and auto-restart
5. Go live! 🎉

