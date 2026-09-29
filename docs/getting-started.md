# Getting started

## Requirements

- Docker with Docker Compose
- A separate Minecraft Java Edition account for the bot (about $30)
- A free Azure subscription, for the Microsoft sign-in
- A Minecraft server, Paper recommended, with the ViaBackwards plugin
- A YouTube or Twitch stream key
- Optional: an Intel iGPU for hardware encoding

## 1. Clone the repository

```bash
git clone https://github.com/GeiserX/Minecraft-Youtube-Follower.git
cd Minecraft-Youtube-Follower
```

## 2. Register an Azure app

Microsoft accounts sign in through OAuth, which needs an Azure app registration.

1. Personal Microsoft accounts need a free Azure subscription: sign up at <https://azure.microsoft.com/free/>. The credit card is for verification only.
2. In <https://portal.azure.com> open Azure Active Directory (Microsoft Entra ID), then App registrations, then New registration.
3. Give it any name, pick "Accounts in any organizational directory and personal Microsoft accounts", leave the redirect URI empty, and click Register.
4. Copy the Application (client) ID. It goes into `AZURE_CLIENT_ID`.
5. Under Authentication, Advanced settings, set "Allow public client flows" to Yes and save.

## 3. Ask Mojang to approve the app

Mojang approves every new third-party app by hand before it can sign in to Minecraft Java Edition. Until then the bot fails with "Invalid app registration". The steps are in [Mojang API approval](mojang-api-approval.md). Approval can take days or weeks.

## 4. Configure `.env`

```bash
cp .env.example .env
```

Fill in at least `MINECRAFT_USERNAME`, `SERVER_HOST`, `SERVER_PORT`, `AZURE_CLIENT_ID` and your stream key. Every other variable, and the showcase locations the bot tours when nobody is online, is on [Configuration](configuration.md).

To get a stream key:

- YouTube: [YouTube Studio](https://studio.youtube.com), Go Live, Stream, copy the Stream Key into `YOUTUBE_STREAM_KEY`.
- Twitch: [Creator Dashboard](https://dashboard.twitch.tv), Settings, Stream, copy the Primary Stream Key into `TWITCH_STREAM_KEY` and set `STREAM_PLATFORM=twitch`.

## 5. Start the services

With the published images:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Or, to build from this checkout (the code is mounted, so later changes need only a restart; see [Development](development.md)):

```bash
docker compose up -d --build
```

## 6. Sign the bot in

Once Mojang has approved the app, sign in once:

1. Read the bot's log: `docker compose logs -f minecraft-spectator-bot` (add `-f docker-compose.prod.yml` before `logs` if you started the published images).
2. The bot prints a line such as `To sign in, use a web browser to open the page https://www.microsoft.com/link and enter the code ABC123XYZ`.
3. Open <https://www.microsoft.com/link>, enter the code, and sign in with the bot's Microsoft account.

The tokens are cached in the `minecraft-bot-auth` volume, so later restarts connect on their own.

## Server configuration

Your Minecraft server needs:

1. The [ViaBackwards](https://github.com/ViaVersion/ViaBackwards) plugin, so the bot connects whatever the version difference.
2. The bot whitelisted and opped:
   ```bash
   /whitelist add <bot_username>
   /op <bot_username>
   ```
3. `online-mode=true` in `server.properties`, which the Microsoft sign-in requires.
