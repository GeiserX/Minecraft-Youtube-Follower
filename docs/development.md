# Development

## Live Code Updates

Code changes apply without rebuilding:

- `bot/spectator-bot.js` - Restart bot container
- `streaming/capture-viewer.js` - Restart streaming container
- `streaming/streaming-service.py` - Restart streaming container

```bash
docker-compose restart minecraft-spectator-bot  # For bot changes
docker-compose restart streaming-service        # For streaming changes
```

## Logs

```bash
docker-compose logs -f minecraft-spectator-bot  # Bot logs
docker-compose logs -f streaming-service        # Streaming logs
docker-compose logs -f                          # All logs
```

## Rebuilding Images

For dependency changes:

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

**GeiserX** - [@GeiserX](https://github.com/GeiserX)
