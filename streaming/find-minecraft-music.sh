#!/bin/bash
# Find and copy Minecraft music files from your installation

MUSIC_DIR="$(dirname "$0")/music"
mkdir -p "$MUSIC_DIR"

echo "Searching for Minecraft music files..."

# Common Minecraft installation locations
MINECRAFT_PATHS=(
    "$HOME/.minecraft/assets/objects"
    "$HOME/Library/Application Support/minecraft/assets/objects"
    "$HOME/.local/share/minecraft/assets/objects"
    "/Users/$USER/Library/Application Support/minecraft/assets/objects"
)

# Find the assets folder
ASSETS_DIR=""
for path in "${MINECRAFT_PATHS[@]}"; do
    if [ -d "$path" ]; then
        ASSETS_DIR="$path"
        echo "Found Minecraft assets at: $ASSETS_DIR"
        break
    fi
done

if [ -z "$ASSETS_DIR" ]; then
    echo "ERROR: Could not find Minecraft installation."
    echo ""
    echo "Please manually locate your Minecraft assets folder:"
    echo "  - macOS: ~/Library/Application Support/minecraft/assets/objects/"
    echo "  - Linux: ~/.minecraft/assets/objects/"
    echo "  - Windows: %appdata%\.minecraft\assets\objects\"
    echo ""
    echo "Then copy .ogg files to: $MUSIC_DIR"
    exit 1
fi

# Find music files (they're typically 1-5MB .ogg files)
echo "Searching for music files..."

# Look for .ogg files in the objects directory
COPIED=0
find "$ASSETS_DIR" -name "*.ogg" -type f 2>/dev/null | while read -r file; do
    # Check if it's likely a music file (not a sound effect) - music files are typically 1-5MB
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        if [ "$size" -gt 500000 ] && [ "$size" -lt 10000000 ]; then
            filename=$(basename "$file")
            # Use hash as filename to avoid conflicts
            cp "$file" "$MUSIC_DIR/${filename}.ogg"
            size_mb=$(echo "scale=1; $size / 1048576" | bc 2>/dev/null || echo "?")
            echo "Copied: $filename - ${size_mb}MB"
            COPIED=$((COPIED + 1))
        fi
    fi
done

# Count files actually copied
ACTUAL_COUNT=$(ls -1 "$MUSIC_DIR"/*.ogg 2>/dev/null | wc -l | tr -d ' ')

if [ "$ACTUAL_COUNT" -eq 0 ]; then
    echo "No music files found."
    echo "Please manually copy .ogg files from: $ASSETS_DIR"
    echo "to: $MUSIC_DIR"
else
    echo ""
    echo "Successfully copied $ACTUAL_COUNT music file(s) to: $MUSIC_DIR"
    echo "Files ready for streaming!"
fi
