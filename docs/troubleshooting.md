# Troubleshooting

## Authentication Issues

- **"Invalid app registration"**: most likely Mojang has not approved the app yet (see [Mojang API approval](mojang-api-approval.md)); otherwise check the Azure app settings in [Getting started](getting-started.md#2-register-an-azure-app)
- **"Account does not exist in tenant"**: the Azure app was registered with the wrong account type; register it again with "Accounts in any organizational directory and personal Microsoft accounts"
- **"invalid_grant"**: public client flows are off; turn on "Allow public client flows" under the app's Authentication settings
- **"first party application" error**: Set `MSAL_AUTHORITY=https://login.microsoftonline.com/common`
- **Tokens not persisting**: Check the `minecraft-bot-auth` Docker volume exists
- **Multiple auth codes**: Wait for authentication to complete before restarting

## Camera Issues

- **Camera too close**: Increase `CAMERA_DISTANCE` (default: 8; see [Configuration](configuration.md#camera-configuration))
- **Camera clipping through walls**: the third-person camera does not avoid blocks; `CAMERA_MODE=spectate` shows the player's own view instead
- **Jerky movement**: Decrease `CAMERA_UPDATE_INTERVAL_MS` (default: 2000)

## Stream Issues

- **Black screen**: Check the streaming service's log (`docker compose logs streaming-service`) and that the viewer answers at http://localhost:3000
- **No hardware encoding**: on Linux, check the iGPU is passed through (`ls -la /dev/dri/`) and the `devices` section of the streaming service is uncommented
- **Low bitrate warning**: Increase `YOUTUBE_VIDEO_BITRATE`
- **High CPU usage**: Enable `USE_HARDWARE_ENCODING=true` (requires Intel iGPU)

## Bot Issues

- **"No players detected"**: Bot reads from tab-list; ensure players are actually online
- **Bot not moving**: Check bot has OP permissions on server
- **Bot cannot connect**: check `SERVER_HOST` and `SERVER_PORT` in `.env`, that the server lets the bot's IP in and has it whitelisted, and the bot's log (`docker compose logs minecraft-spectator-bot`)

## Voice Chat Issues

- Check the Mumble server's log: `docker compose logs mumble-server`
- Check that port 64738 (`MUMBLE_PORT`) is reachable, TCP and UDP
- Test with a Mumble client connected to `localhost:64738`
