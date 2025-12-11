#!/usr/bin/env python3
"""
Minecraft Streaming Service
Captures spectator bot view using Puppeteer and streams to YouTube/Twitch with Mumble voice chat
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
MUMBLE_SERVER = os.getenv('MUMBLE_SERVER', 'localhost')
MUMBLE_PORT = int(os.getenv('MUMBLE_PORT', '64738'))
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
puppeteer_process = None

def wait_for_service(url, service_name, timeout=300):
    """Wait for a service to become available"""
    logger.info(f'Waiting for {service_name} to be ready...')
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}", timeout=5)
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

def start_puppeteer_capture():
    """Start Puppeteer to capture the viewer"""
    global puppeteer_process
    
    # Start Node.js script to run Puppeteer
    if os.name == 'nt':
        # Windows: Use different approach
        logger.info('Windows detected - Puppeteer will run separately')
        return True
    
    logger.info('Starting Puppeteer capture script...')
    try:
        puppeteer_process = subprocess.Popen(
            ['node', '/app/capture-viewer.js'],
            env={**os.environ, 'DISPLAY': ':99'},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        time.sleep(5)  # Give Puppeteer time to start
        logger.info('Puppeteer capture started')
        return True
    except Exception as e:
        logger.error(f'Failed to start Puppeteer: {e}')
        return False

def start_stream():
    """Start FFmpeg streaming process"""
    global ffmpeg_process
    
    # Wait for services to be ready
    if not wait_for_service(SPECTATOR_URL, 'Spectator bot viewer'):
        return False
    
    logger.info(f'Starting stream to {STREAM_PLATFORM}...')
    
    # Build FFmpeg command
    # Capture from X11 display (where Puppeteer will render the viewer)
    # Mix Mumble audio with game audio (if available)
    
    # Check if we're on Windows (no /dev/dri)
    is_windows = os.name == 'nt' or not os.path.exists('/dev/dri/renderD128')
    
    # Video source: X11 display capture (Puppeteer will render viewer here)
    video_input = [
        '-f', 'x11grab',
        '-video_size', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}',
        '-framerate', '30',
        '-i', ':99.0'
    ]
    
    # Audio sources: Mumble (via PulseAudio) and game audio
    # Note: On Windows, we'll need to adapt this
    audio_inputs = []
    audio_filters = []
    
    if not is_windows:
        # Linux: Use PulseAudio
        # Mumble audio (if available)
        audio_inputs.extend([
            '-f', 'pulse',
            '-i', 'mumble_output'
        ])
        audio_filters.append(f'[0:a]volume={VOICE_VOLUME_GAIN}[voice]')
        
        # Game audio (placeholder - would need to capture from Minecraft)
        audio_inputs.extend([
            '-f', 'pulse',
            '-i', 'game_audio'
        ])
        audio_filters.append(f'[1:a]volume={GAME_MUSIC_VOLUME_GAIN}[game]')
        audio_filters.append('[voice][game]amix=inputs=2:duration=longest[out]')
    else:
        # Windows: Use different audio capture method
        # For now, just use video (audio can be added later)
        logger.warning('Windows audio capture not fully implemented - video only for now')
    
    # Base FFmpeg command
    ffmpeg_cmd = ['ffmpeg'] + video_input
    
    # Add audio inputs if available
    if audio_inputs:
        ffmpeg_cmd.extend(audio_inputs)
    
    # Video encoding
    if is_windows or not os.path.exists('/dev/dri/renderD128'):
        # Software encoding
        ffmpeg_cmd.extend([
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-b:v', '3000k',
            '-maxrate', '3000k',
            '-bufsize', '6000k',
            '-g', '60',
            '-pix_fmt', 'yuv420p'
        ])
    else:
        # Intel iGPU hardware encoding
        logger.info('Intel iGPU detected, using hardware encoding')
        ffmpeg_cmd.extend([
            '-vaapi_device', '/dev/dri/renderD128',
            '-vf', 'format=nv12,hwupload',
            '-c:v', 'h264_vaapi',
            '-b:v', '3000k',
            '-maxrate', '3000k',
            '-bufsize', '6000k',
            '-g', '60'
        ])
    
    # Audio encoding
    if audio_filters:
        ffmpeg_cmd.extend([
            '-filter_complex', ';'.join(audio_filters),
            '-map', '0:v',
            '-map', '[out]',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100'
        ])
    else:
        # No audio for now
        ffmpeg_cmd.extend([
            '-map', '0:v',
            '-an'  # No audio
        ])
    
    # Output
    ffmpeg_cmd.extend([
        '-f', 'flv',
        STREAM_URL
    ])
    
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
    global ffmpeg_process, xvfb_process, puppeteer_process
    
    logger.info('Cleaning up...')
    
    if ffmpeg_process:
        ffmpeg_process.terminate()
        try:
            ffmpeg_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            ffmpeg_process.kill()
    
    if puppeteer_process:
        puppeteer_process.terminate()
        try:
            puppeteer_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            puppeteer_process.kill()
    
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
    
    # Start virtual display (Linux only)
    if os.name != 'nt':
        start_xvfb()
    
    # Start Puppeteer capture
    start_puppeteer_capture()
    
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
