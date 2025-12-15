#!/bin/bash
# Download royalty-free relaxing music for streaming
# Safe to use on YouTube/Twitch streams
#
# Usage: ./download-music.sh
#
# Options:
#   --youtube   Download from YouTube (requires yt-dlp)
#   --freepd    Download from FreePD.com (public domain)
#   --all       Download from all sources

set -e

MUSIC_DIR="$(dirname "$0")/music"
mkdir -p "$MUSIC_DIR"
cd "$MUSIC_DIR"

echo "==========================================="
echo "Royalty-Free Music Downloader"
echo "==========================================="
echo "Output: $MUSIC_DIR"
echo ""

download_freepd() {
    echo "Downloading from FreePD.com (Public Domain)..."
    echo "These tracks are 100% free to use commercially."
    echo ""
    
    # FreePD.com - Public Domain music (no attribution required)
    # Relaxing/Ambient category
    TRACKS=(
        "https://freepd.com/music/Serenity.mp3"
        "https://freepd.com/music/Floating%20Cities.mp3"
        "https://freepd.com/music/Dreams.mp3"
        "https://freepd.com/music/Morning%20Mood.mp3"
        "https://freepd.com/music/Peaceful.mp3"
        "https://freepd.com/music/Relaxing.mp3"
        "https://freepd.com/music/Ethereal.mp3"
        "https://freepd.com/music/Ambient%20Piano.mp3"
        "https://freepd.com/music/Calm.mp3"
        "https://freepd.com/music/Meditation.mp3"
    )
    
    for url in "${TRACKS[@]}"; do
        filename=$(basename "$url" | sed 's/%20/ /g')
        if [ ! -f "$filename" ]; then
            echo "  Downloading: $filename"
            curl -sL -o "$filename" "$url" 2>/dev/null || echo "    (failed)"
        else
            echo "  Skipping (exists): $filename"
        fi
    done
}

download_youtube() {
    echo "Downloading ambient music via yt-dlp..."
    echo ""
    
    if ! command -v yt-dlp &> /dev/null; then
        echo "yt-dlp not found. Installing..."
        pip3 install yt-dlp 2>/dev/null || brew install yt-dlp 2>/dev/null || {
            echo "Please install yt-dlp: pip install yt-dlp"
            return 1
        }
    fi
    
    # Search for ambient/relaxing music (will get various royalty-free tracks)
    yt-dlp \
        --extract-audio \
        --audio-format mp3 \
        --audio-quality 192K \
        --no-playlist \
        --output "%(title)s.%(ext)s" \
        --no-overwrites \
        --max-downloads 15 \
        --match-filter "duration < 600" \
        --quiet \
        --progress \
        "ytsearch15:no copyright ambient relaxing music for streaming" 2>/dev/null || true
}

# Parse arguments
MODE="${1:-freepd}"

case "$MODE" in
    --youtube|-y)
        download_youtube
        ;;
    --freepd|-f)
        download_freepd
        ;;
    --all|-a)
        download_freepd
        echo ""
        download_youtube
        ;;
    *)
        download_freepd
        ;;
esac

echo ""
echo "==========================================="
echo "Download complete!"
echo ""

# Count files
mp3_count=$(ls -1 *.mp3 2>/dev/null | wc -l | tr -d ' ')
ogg_count=$(ls -1 *.ogg 2>/dev/null | wc -l | tr -d ' ')
total=$((mp3_count + ogg_count))

echo "Music files: $total"
if [ "$total" -gt 0 ]; then
    echo ""
    ls -lh *.mp3 *.ogg 2>/dev/null | head -20
fi

echo ""
echo "==========================================="
echo "To use in your stream:"
echo "  ENABLE_MUSIC=true"
echo "  MUSIC_VOLUME=0.15"
echo ""
echo "Volume is set low (15%) so voice chat remains clear."
echo "==========================================="
