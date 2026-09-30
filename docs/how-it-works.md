# How it works

## Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view via Puppeteer and streams to YouTube/Twitch using FFmpeg
- **mumble-server**: Mumble VoIP server for player voice communication

## From the server to the stream

1. Bot authenticates with Microsoft account (tokens cached in Docker volume)
2. Bot joins your Minecraft server in spectator mode
3. Bot detects active players from tab-list
4. Camera positions behind player, looking at their face
5. Spectator view rendered via prismarine-viewer web interface
6. Puppeteer captures the viewer in headless Chrome
7. FFmpeg encodes (with hardware acceleration if available) and streams
8. Player name overlay added to stream
9. When nobody is online, the bot marks the stream paused and the streaming service stops FFmpeg; it starts again when a player joins

What this looks like on the stream is in [Usage](usage.md#what-the-stream-shows).
