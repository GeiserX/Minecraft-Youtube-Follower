# Minecraft Music Files

Place Minecraft music files (`.ogg` or `.mp3` format) in this directory to add background music to your stream.

## Getting Minecraft Music Files

### Option 1: Extract from Minecraft Installation

Minecraft music files are stored in the game's assets folder:

**Windows:**
```
%appdata%\.minecraft\assets\objects\
```

**Linux:**
```
~/.minecraft/assets/objects/
```

**macOS:**
```
~/Library/Application Support/minecraft/assets/objects/
```

Look for files with hash names (like `a1b2c3d4e5f6...`) and copy the `.ogg` files. You can identify music files by their size (typically 1-5 MB) and by checking the `indexes` folder for file mappings.

### Option 2: Download from Minecraft Wiki

The Minecraft Wiki hosts music files:
- https://minecraft.wiki/w/Music

### Option 3: Use Any Background Music

You can use any `.ogg` or `.mp3` files as background music. The system will loop through all files in this directory seamlessly.

## Configuration

Set these environment variables in `.env`:

- `ENABLE_MUSIC=true` - Enable/disable music (default: `true`)
- `MUSIC_VOLUME=0.3` - Music volume (0.0-1.0, default: `0.3` = 30%)

## How It Works

1. The streaming service scans this directory for `.ogg` and `.mp3` files
2. Creates a playlist that loops infinitely
3. Mixes the music with the video stream at the configured volume
4. If no music files are found, the stream uses silent audio

## File Format

- **Preferred**: `.ogg` (Ogg Vorbis) - native Minecraft format
- **Supported**: `.mp3` (MPEG Audio)

Files are played in alphabetical order and loop seamlessly.
