#!/usr/bin/env python3
"""
Minecraft Streaming Service
Captures spectator bot view and streams to YouTube/Twitch with voice chat integration
"""

import subprocess
import time
import requests
import os
import signal
import sys
import logging
from pathlib import Path

# Configure logging
log_dir = Path('/app/logs')
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'streaming.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Configuration from environment
SPECTATOR_URL = os.getenv('SPECTATOR_URL', 'http://minecraft-spectator-bot:3000')
VOICE_SERVER_URL = os.getenv('VOICE_SERVER_URL', 'http://voice-server:8080')
YOUTUBE_STREAM_KEY = os.getenv('YOUTUBE_STREAM_KEY')
TWITCH_STREAM_KEY = os.getenv('TWITCH_STREAM_KEY')
STREAM_PLATFORM = os.getenv('STREAM_PLATFORM', 'youtube').lower()
DISPLAY_WIDTH = int(os.getenv('DISPLAY_WIDTH', '1920'))
DISPLAY_HEIGHT = int(os.getenv('DISPLAY_HEIGHT', '1080'))
VOICE_VOLUME_GAIN = float(os.getenv('VOICE_VOLUME_GAIN', '2.0'))
GAME_MUSIC_VOLUME_GAIN = float(os.getenv('GAME_MUSIC_VOLUME_GAIN', '0.5'))

# Determine stream URL based on platform
if STREAM_PLATFORM == 'youtube':
    if not YOUTUBE_STREAM_KEY:
        logger.error('YOUTUBE_STREAM_KEY is required for YouTube streaming')
        sys.exit(1)
    STREAM_URL = f"rtmp://a.rtmp.youtube.com/live2/{YOUTUBE_STREAM_KEY}"
elif STREAM_PLATFORM == 'twitch':
    if not TWITCH_STREAM_KEY:
        logger.error('TWITCH_STREAM_KEY is required for Twitch streaming')
        sys.exit(1)
    STREAM_URL = f"rtmp://live.twitch.tv/app/{TWITCH_STREAM_KEY}"
else:
    logger.error(f'Unknown streaming platform: {STREAM_PLATFORM}')
    sys.exit(1)

ffmpeg_process = None
xvfb_process = None

def wait_for_service(url, service_name, timeout=300):
    """Wait for a service to become available"""
    logger.info(f'Waiting for {service_name} to be ready...')
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                logger.info(f'{service_name} is ready!')
                return True
        except requests.exceptions.RequestException:
            pass
        
        time.sleep(5)
    
    logger.error(f'{service_name} did not become ready within {timeout} seconds')
    return False

def start_xvfb():
    """Start virtual display server"""
    global xvfb_process
    logger.info('Starting Xvfb...')
    xvfb_process = subprocess.Popen([
        'Xvfb', ':99',
        '-screen', '0', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}x24',
        '-ac', '+extension', 'GLX', '+render', '-noreset'
    ])
    time.sleep(2)
    logger.info('Xvfb started')

def start_stream():
    """Start FFmpeg streaming process"""
    global ffmpeg_process
    
    # Wait for services to be ready
    if not wait_for_service(SPECTATOR_URL, 'Spectator bot'):
        return False
    
    if not wait_for_service(VOICE_SERVER_URL, 'Voice server'):
        logger.warning('Voice server not ready, continuing without voice chat')
    
    logger.info(f'Starting stream to {STREAM_PLATFORM}...')
    
    # Build FFmpeg command
    # Note: This is a simplified version. In production, you'd need to:
    # 1. Capture the spectator bot's view (may need to use browser automation or direct capture)
    # 2. Capture voice server audio stream
    # 3. Mix audio sources with proper volume levels
    
    # For now, this is a placeholder that shows the structure
    # You'll need to adapt based on how prismarine-viewer exposes the video stream
    
    ffmpeg_cmd = [
        'ffmpeg',
        '-f', 'lavfi',
        '-i', 'testsrc2=size=1920x1080:rate=30',  # Placeholder - replace with actual video source
        '-f', 'lavfi',
        '-i', 'sine=frequency=1000:duration=0',  # Placeholder - replace with actual audio source
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-b:v', '3000k',
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-g', '60',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'flv',
        STREAM_URL
    ]
    
    # If Intel iGPU is available, use hardware encoding (Linux only)
    # On Windows, this path won't exist, so we'll use software encoding
    if os.path.exists('/dev/dri/renderD128'):
        logger.info('Intel iGPU detected, using hardware encoding')
        ffmpeg_cmd = [
            'ffmpeg',
            '-f', 'lavfi',
            '-i', 'testsrc2=size=1920x1080:rate=30',  # Placeholder
            '-f', 'lavfi',
            '-i', 'sine=frequency=1000:duration=0',  # Placeholder
            '-vaapi_device', '/dev/dri/renderD128',
            '-vf', 'format=nv12,hwupload',
            '-c:v', 'h264_vaapi',
            '-b:v', '3000k',
            '-maxrate', '3000k',
            '-bufsize', '6000k',
            '-g', '60',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-f', 'flv',
            STREAM_URL
        ]
    
    try:
        logger.info(f'Starting FFmpeg: {" ".join(ffmpeg_cmd)}')
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Monitor FFmpeg output
        def monitor_ffmpeg():
            for line in ffmpeg_process.stderr:
                logger.debug(f'FFmpeg: {line.strip()}')
        
        import threading
        monitor_thread = threading.Thread(target=monitor_ffmpeg, daemon=True)
        monitor_thread.start()
        
        logger.info('Stream started successfully!')
        return True
        
    except Exception as e:
        logger.error(f'Failed to start stream: {e}')
        return False

def cleanup():
    """Clean up processes"""
    global ffmpeg_process, xvfb_process
    
    logger.info('Cleaning up...')
    
    if ffmpeg_process:
        ffmpeg_process.terminate()
        try:
            ffmpeg_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            ffmpeg_process.kill()
    
    if xvfb_process:
        xvfb_process.terminate()
        try:
            xvfb_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            xvfb_process.kill()
    
    logger.info('Cleanup complete')

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info('Received shutdown signal')
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    """Main function"""
    logger.info('Minecraft Streaming Service starting...')
    
    # Start virtual display
    start_xvfb()
    
    # Start streaming
    if not start_stream():
        logger.error('Failed to start streaming')
        cleanup()
        sys.exit(1)
    
    # Keep running
    try:
        while True:
            if ffmpeg_process and ffmpeg_process.poll() is not None:
                logger.error('FFmpeg process died, restarting...')
                time.sleep(5)
                if not start_stream():
                    logger.error('Failed to restart stream')
                    break
            time.sleep(10)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()

