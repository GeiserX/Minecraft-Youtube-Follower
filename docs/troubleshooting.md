# Troubleshooting

## Authentication Issues

- **"first party application" error**: Set `MSAL_AUTHORITY=https://login.microsoftonline.com/common`
- **Tokens not persisting**: Check the `minecraft-bot-auth` Docker volume exists
- **Multiple auth codes**: Wait for authentication to complete before restarting

## Camera Issues

- **Camera too close**: Increase `CAMERA_DISTANCE` (default: 6)
- **Camera clipping through walls**: This is adaptive; ensure `CAMERA_MODE=third-person`
- **Jerky movement**: Decrease `CAMERA_UPDATE_INTERVAL_MS` (default: 500)

## Stream Issues

- **Black screen**: Check Puppeteer logs, ensure viewer is accessible
- **Low bitrate warning**: Increase `YOUTUBE_VIDEO_BITRATE`
- **High CPU usage**: Enable `USE_HARDWARE_ENCODING=true` (requires Intel iGPU)

## Bot Issues

- **"No players detected"**: Bot reads from tab-list; ensure players are actually online
- **Bot not moving**: Check bot has OP permissions on server
