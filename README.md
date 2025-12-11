# Minecraft YouTube Follower

A Docker-based system for 24/7 automated streaming of your Minecraft server with intelligent player following, dynamic split-screen views, and integrated voice chat.

## Features

- 🤖 **Automated Spectator Bot**: Uses Mineflayer to follow players in spectator mode (noclip, invisible)
- 📹 **24/7 Streaming**: Continuous YouTube/Twitch streaming with Intel iGPU hardware acceleration
- 🎯 **Smart Player Tracking**: Automatically follows the most active player, switches every 30 seconds
- 🎬 **Dynamic Split-Screen**: Automatically adjusts layout based on player count (1-4 players)
- 🏗️ **Base Showcase Mode**: Tours interesting builds when no players are online
- 🎤 **Voice Chat Integration**: Web-based voice server for mobile/web access, mixed into stream
- 🐳 **Docker Native**: Fully containerized for easy deployment on Unraid
- 🔧 **Paper + GeyserMC Compatible**: Works with both Java and Bedrock players

## Requirements

- Unraid system with Docker support
- Intel iGPU (for hardware-accelerated encoding)
- Minecraft Java Edition account for the bot (~$30)
- Stable internet connection with sufficient upload bandwidth
- YouTube or Twitch streaming key

## Quick Start

1. **Purchase a Minecraft account** for the bot
2. **Clone this repository**:
   ```bash
   git clone https://github.com/yourusername/Minecraft-Youtube-Follower.git
   cd Minecraft-Youtube-Follower
   ```

3. **Configure environment variables** in `docker-compose.yml`:
   - `MINECRAFT_USERNAME`: Bot's Minecraft username
   - `MINECRAFT_PASSWORD`: Bot's Minecraft password
   - `SERVER_HOST`: Your Minecraft server IP
   - `SERVER_PORT`: Your Minecraft server port (default: 25565)
   - `YOUTUBE_STREAM_KEY`: Your YouTube streaming key

4. **Deploy**:
   ```bash
   docker-compose up -d
   ```

## Architecture

### Services

- **minecraft-spectator-bot**: Mineflayer bot that joins server in spectator mode and follows players
- **streaming-service**: Captures bot's view and streams to YouTube/Twitch using Intel iGPU
- **voice-server**: WebRTC-based voice chat server for player communication

### How It Works

1. Bot joins your Minecraft server in spectator mode
2. Bot detects active players and follows the most active one
3. Bot switches between players every 30 seconds (if multiple are active)
4. Spectator view is captured and streamed to YouTube/Twitch
5. Voice chat audio is mixed into the stream at higher volume than game music
6. When no players are online, bot showcases interesting builds

## Configuration

See `docker-compose.yml` and individual service directories for configuration options.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This project is for educational and personal use. Ensure you comply with:
- Minecraft's Terms of Service
- YouTube/Twitch streaming policies
- Your server's rules and regulations

