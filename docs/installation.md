# Installation

## Requirements

- Docker and Docker Compose
- Minecraft Java Edition account for the bot (~$30)
- Free Azure subscription (for Microsoft account authentication)
- Minecraft server (Paper recommended, with ViaBackwards plugin)
- YouTube or Twitch streaming key
- (Optional) Intel iGPU for hardware-accelerated encoding

## Deploy

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

The complete guide, including Azure and authentication, is in [SETUP.md](SETUP.md).

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
