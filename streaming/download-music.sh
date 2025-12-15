#!/bin/bash
# Download Minecraft music files for streaming
# Minecraft music files are available from various sources

set -e

MUSIC_DIR="/app/music"
mkdir -p "$MUSIC_DIR"

echo "Downloading Minecraft music files..."

# Minecraft music files (ogg format) - these are the official game music files
# Note: These URLs may need to be updated. You can also manually download from:
# - Minecraft Wiki: https://minecraft.wiki/w/Music
# - Or extract from Minecraft game files

# List of Minecraft music tracks (you can add more)
MUSIC_FILES=(
    "https://github.com/MinecraftWiki/music/raw/main/music/menu/menu1.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/menu/menu2.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/menu/menu3.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/menu/menu4.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/calm1.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/calm2.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/calm3.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/hal1.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/hal2.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/hal3.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/hal4.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/nuance1.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/nuance2.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/piano1.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/piano2.ogg"
    "https://github.com/MinecraftWiki/music/raw/main/music/game/piano3.ogg"
)

# Try to download files, but don't fail if URLs are broken
for url in "${MUSIC_FILES[@]}"; do
    filename=$(basename "$url")
    if [ ! -f "$MUSIC_DIR/$filename" ]; then
        echo "Downloading $filename..."
        curl -L -f -s "$url" -o "$MUSIC_DIR/$filename" || echo "Failed to download $filename (URL may be outdated)"
    else
        echo "$filename already exists, skipping..."
    fi
done

# If no files were downloaded, create a placeholder
if [ -z "$(ls -A $MUSIC_DIR/*.ogg 2>/dev/null)" ]; then
    echo "WARNING: No music files downloaded. You can:"
    echo "1. Manually download Minecraft music files (.ogg format) to $MUSIC_DIR"
    echo "2. Extract from Minecraft game files:"
    echo "   - Windows: %appdata%/.minecraft/assets/objects/"
    echo "   - Linux: ~/.minecraft/assets/objects/"
    echo "   - macOS: ~/Library/Application Support/minecraft/assets/objects/"
    echo "3. Use any .ogg audio files as background music"
    exit 1
fi

echo "Music files ready in $MUSIC_DIR"
ls -lh "$MUSIC_DIR"/*.ogg 2>/dev/null | head -5

