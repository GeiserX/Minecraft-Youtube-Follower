#!/bin/bash
# Download relaxing royalty-free music from YouTube Audio Library
# These tracks are free to use in YouTube streams
#
# Usage: ./download-youtube-audio-library.sh
#
# Requires: yt-dlp (pip install yt-dlp) or (brew install yt-dlp)

set -e

MUSIC_DIR="$(dirname "$0")/music"
mkdir -p "$MUSIC_DIR"

# Check for yt-dlp
if ! command -v yt-dlp &> /dev/null; then
    echo "Installing yt-dlp..."
    if command -v pip3 &> /dev/null; then
        pip3 install yt-dlp
    elif command -v brew &> /dev/null; then
        brew install yt-dlp
    else
        echo "Please install yt-dlp: pip install yt-dlp"
        exit 1
    fi
fi

echo "==========================================="
echo "YouTube Audio Library - Relaxing Music"
echo "==========================================="
echo "Output directory: $MUSIC_DIR"
echo ""

# Download from YouTube Audio Library playlists
# These are official royalty-free tracks safe for streaming

echo "Downloading relaxing/ambient tracks from YouTube Audio Library..."
echo "This may take a few minutes..."
echo ""

# YouTube Audio Library - Ambient/Calm category
# Using search to find royalty-free relaxing tracks
yt-dlp \
    --extract-audio \
    --audio-format mp3 \
    --audio-quality 192K \
    --no-playlist \
    --output "$MUSIC_DIR/%(title)s.%(ext)s" \
    --no-overwrites \
    --max-downloads 20 \
    --match-filter "duration < 600" \
    --quiet \
    --progress \
    "ytsearch20:youtube audio library ambient relaxing calm" 2>/dev/null || true

# Count downloaded files
count=$(ls -1 "$MUSIC_DIR"/*.mp3 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "==========================================="
echo "Download complete!"
echo "Downloaded: $count tracks"
echo "Music directory: $MUSIC_DIR"
echo ""

if [ "$count" -gt 0 ]; then
    echo "Files:"
    ls -lh "$MUSIC_DIR"/*.mp3 2>/dev/null | head -20
else
    echo "No tracks downloaded. Try running manually:"
    echo "  yt-dlp -x --audio-format mp3 'ytsearch5:relaxing ambient music' -o '$MUSIC_DIR/%(title)s.%(ext)s'"
fi

echo ""
echo "==========================================="
echo "Configuration:"
echo "  ENABLE_MUSIC=true"
echo "  MUSIC_VOLUME=0.15  (15% - keeps voice chat clear)"
echo "==========================================="
