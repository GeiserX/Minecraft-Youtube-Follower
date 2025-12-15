#!/usr/bin/env python3
"""
Minecraft Streaming Service - Optimized for Intel iGPU
"""

import subprocess
import time
import requests
import os
import signal
import sys
import logging
import threading
from pathlib import Path

# Logging setup
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

# Configuration
SPECTATOR_URL = os.getenv('SPECTATOR_URL', 'http://minecraft-spectator-bot:3000')
YOUTUBE_STREAM_KEY = os.getenv('YOUTUBE_STREAM_KEY')
TWITCH_STREAM_KEY = os.getenv('TWITCH_STREAM_KEY')
STREAM_PLATFORM = os.getenv('STREAM_PLATFORM', 'youtube').lower()
YOUTUBE_INGEST_METHOD = os.getenv('YOUTUBE_INGEST_METHOD', 'rtmp').lower()
YOUTUBE_HLS_HTTP_METHOD = os.getenv('YOUTUBE_HLS_HTTP_METHOD', 'PUT').upper()
YOUTUBE_HLS_URL = os.getenv('YOUTUBE_HLS_URL')

# Video settings
YOUTUBE_VIDEO_BITRATE = os.getenv('YOUTUBE_VIDEO_BITRATE', '2500k')
YOUTUBE_MAXRATE = os.getenv('YOUTUBE_MAXRATE', YOUTUBE_VIDEO_BITRATE)
YOUTUBE_BUFSIZE = os.getenv('YOUTUBE_BUFSIZE', '5000k')
YOUTUBE_OUTPUT_WIDTH = int(os.getenv('YOUTUBE_OUTPUT_WIDTH', '1280'))
YOUTUBE_OUTPUT_HEIGHT = int(os.getenv('YOUTUBE_OUTPUT_HEIGHT', '720'))
YOUTUBE_FRAMERATE = int(os.getenv('YOUTUBE_FRAMERATE', '30'))
DISPLAY_WIDTH = int(os.getenv('DISPLAY_WIDTH', '1280'))
DISPLAY_HEIGHT = int(os.getenv('DISPLAY_HEIGHT', '720'))

# Encoding
USE_HARDWARE_ENCODING = os.getenv('USE_HARDWARE_ENCODING', 'true').lower() == 'true'
VAAPI_DEVICE = os.getenv('VAAPI_DEVICE', '/dev/dri/renderD128')
ENCODER_PRESET = os.getenv('ENCODER_PRESET', 'faster')

# Audio/Music
MUSIC_DIR = os.getenv('MUSIC_DIR', '/app/music')
ENABLE_MUSIC = os.getenv('ENABLE_MUSIC', 'true').lower() == 'true'
MUSIC_VOLUME = float(os.getenv('MUSIC_VOLUME', '0.3'))

# Overlay
ENABLE_OVERLAY = os.getenv('ENABLE_OVERLAY', 'true').lower() == 'true'
OVERLAY_FONT_SIZE = int(os.getenv('OVERLAY_FONT_SIZE', '24'))
OVERLAY_POSITION = os.getenv('OVERLAY_POSITION', 'top-left')
TARGET_FILE = '/app/config/current_target.txt'

# Build stream URL
if STREAM_PLATFORM == 'youtube':
    if YOUTUBE_INGEST_METHOD == 'hls':
        if YOUTUBE_HLS_URL:
            STREAM_URL = YOUTUBE_HLS_URL
        else:
            if not YOUTUBE_STREAM_KEY:
                logger.error('YOUTUBE_HLS_URL or YOUTUBE_STREAM_KEY required for HLS')
                sys.exit(1)
            STREAM_URL = f"https://a.upload.youtube.com/http_upload_hls?cid={YOUTUBE_STREAM_KEY}&copy=0&file=master.m3u8"
    else:
        if not YOUTUBE_STREAM_KEY:
            logger.error('YOUTUBE_STREAM_KEY required for RTMP')
            sys.exit(1)
        STREAM_URL = f"rtmp://a.rtmp.youtube.com/live2/{YOUTUBE_STREAM_KEY}"
elif STREAM_PLATFORM == 'twitch':
    if not TWITCH_STREAM_KEY:
        logger.error('TWITCH_STREAM_KEY required')
        sys.exit(1)
    STREAM_URL = f"rtmp://live.twitch.tv/app/{TWITCH_STREAM_KEY}"
else:
    logger.error(f'Unknown platform: {STREAM_PLATFORM}')
    sys.exit(1)

ffmpeg_process = None
xvfb_process = None
puppeteer_process = None

def _has_x_windows():
    try:
        out = subprocess.check_output(
            ['xwininfo', '-root', '-tree'],
            env={**os.environ, 'DISPLAY': ':99'},
            stderr=subprocess.STDOUT,
            text=True,
            timeout=5
        )
        return '0 children.' not in out
    except:
        return False

def wait_for_x_windows(timeout=90):
    start = time.time()
    while time.time() - start < timeout:
        if _has_x_windows():
            return True
        time.sleep(1)
    return False

def wait_for_service(url, name, timeout=300):
    logger.info(f'Waiting for {name}...')
    start = time.time()
    while time.time() - start < timeout:
        try:
            if requests.get(url, timeout=5).status_code == 200:
                logger.info(f'{name} ready')
                return True
        except:
            pass
        time.sleep(1)
    logger.error(f'{name} not ready')
    return False

def start_xvfb():
    global xvfb_process
    logger.info('Starting Xvfb...')
    xvfb_process = subprocess.Popen([
        'Xvfb', ':99',
        '-screen', '0', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}x24',
        '-ac', '+extension', 'GLX', '+render', '-noreset'
    ])
    time.sleep(1)

def start_puppeteer():
    global puppeteer_process
    if not wait_for_service(SPECTATOR_URL, 'Viewer'):
        return False
    
    logger.info('Starting Puppeteer...')
    try:
        puppeteer_process = subprocess.Popen(
            ['node', '/app/capture-viewer.js'],
            env={**os.environ, 'DISPLAY': ':99'},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        time.sleep(1)
        return True
    except Exception as e:
        logger.error(f'Puppeteer failed: {e}')
        return False

def get_music_files():
    if not ENABLE_MUSIC:
        return None
    music_path = Path(MUSIC_DIR)
    if not music_path.exists():
        return None
    files = list(music_path.glob('*.ogg')) + list(music_path.glob('*.mp3'))
    if files:
        files.sort()
        logger.info(f'Found {len(files)} music files')
    return files if files else None

def create_playlist(files):
    if not files:
        return None
    playlist = Path('/tmp/music_playlist.txt')
    with open(playlist, 'w') as f:
        for file in files:
            f.write(f"file '{file.resolve()}'\n")
    return str(playlist)

def check_vaapi():
    if not USE_HARDWARE_ENCODING or not os.path.exists(VAAPI_DEVICE):
        return False
    try:
        result = subprocess.run(
            ['ffmpeg', '-hide_banner', '-init_hw_device', f'vaapi=va:{VAAPI_DEVICE}', 
             '-f', 'lavfi', '-i', 'nullsrc', '-t', '0.1', '-f', 'null', '-'],
            capture_output=True, timeout=10
        )
        if result.returncode == 0:
            logger.info('VAAPI available')
            return True
    except:
        pass
    logger.info('Using software encoding')
    return False

def build_overlay_filter():
    if not ENABLE_OVERLAY:
        return None
    
    positions = {
        'top-left': 'x=20:y=20',
        'top-right': 'x=w-tw-20:y=20',
        'bottom-left': 'x=20:y=h-th-20',
        'bottom-right': 'x=w-tw-20:y=h-th-20',
    }
    pos = positions.get(OVERLAY_POSITION, positions['top-left'])
    
    # Ensure target file exists
    try:
        os.makedirs(os.path.dirname(TARGET_FILE), exist_ok=True)
        if not os.path.exists(TARGET_FILE):
            with open(TARGET_FILE, 'w') as f:
                f.write('')
    except:
        pass
    
    # Bubble-style overlay with rounded appearance (larger box padding, more visible)
    return f"drawtext=textfile='{TARGET_FILE}':reload=1:fontsize={OVERLAY_FONT_SIZE}:fontcolor=white:borderw=3:bordercolor=black:box=1:boxcolor=0x000000@0.7:boxborderw=12:{pos}"

def start_stream():
    global ffmpeg_process
    
    if not wait_for_service(SPECTATOR_URL, 'Viewer'):
        return False
    
    if not wait_for_x_windows(90):
        logger.error('No X windows')
        return False
    
    logger.info(f'Starting stream to {STREAM_PLATFORM}...')
    
    use_vaapi = check_vaapi()
    
    # Build video filter
    filters = [f'scale={YOUTUBE_OUTPUT_WIDTH}:{YOUTUBE_OUTPUT_HEIGHT}']
    overlay = build_overlay_filter()
    if overlay:
        filters.append(overlay)
    
    if use_vaapi:
        filters.extend(['format=nv12', 'hwupload'])
    else:
        filters.append('format=yuv420p')
    
    filter_str = ','.join(filters)
    
    # Video input
    video_input = [
        '-f', 'x11grab',
        '-video_size', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}',
        '-framerate', str(YOUTUBE_FRAMERATE),
        '-draw_mouse', '0',
        '-i', ':99.0'
    ]
    
    # Build command
    if YOUTUBE_INGEST_METHOD == 'hls' and STREAM_PLATFORM == 'youtube':
        return _start_hls(video_input, filter_str, use_vaapi)
    return _start_rtmp(video_input, filter_str, use_vaapi)

def _start_hls(video_input, filter_str, use_vaapi):
    global ffmpeg_process
    
    if STREAM_URL.endswith('file='):
        master_url = f"{STREAM_URL}master.m3u8"
        segment_url = f"{STREAM_URL}segment_%06d.ts"
    else:
        master_url = STREAM_URL
        segment_url = master_url.replace('file=master.m3u8', 'file=segment_%06d.ts')
    
    cmd = ['ffmpeg', '-hide_banner']
    
    if use_vaapi:
        cmd += ['-init_hw_device', f'vaapi=va:{VAAPI_DEVICE}', '-filter_hw_device', 'va']
    
    cmd += video_input
    
    # Audio
    music_files = get_music_files()
    playlist = create_playlist(music_files)
    using_music = playlist is not None
    
    if using_music:
        cmd += ['-f', 'concat', '-safe', '0', '-stream_loop', '-1', '-i', playlist]
    else:
        cmd += ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']
    
    keyframe = YOUTUBE_FRAMERATE * 2
    
    cmd += ['-vf', filter_str]
    
    if use_vaapi:
        cmd += ['-c:v', 'h264_vaapi', '-profile:v', 'main', '-level', '4.0', '-qp', '23', '-bf', '2', '-g', str(keyframe)]
    else:
        cmd += [
            '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '4.0',
            '-preset', ENCODER_PRESET, '-tune', 'zerolatency',
            '-minrate', YOUTUBE_VIDEO_BITRATE, '-b:v', YOUTUBE_VIDEO_BITRATE,
            '-maxrate', YOUTUBE_MAXRATE, '-bufsize', YOUTUBE_BUFSIZE,
            '-x264-params', 'nal-hrd=cbr:filler=1:force-cfr=1',
            '-g', str(keyframe), '-keyint_min', str(keyframe), '-sc_threshold', '0',
            '-pix_fmt', 'yuv420p'
        ]
    
    if using_music:
        cmd += ['-filter_complex', f'[1:a]volume={MUSIC_VOLUME}[music]', '-map', '0:v', '-map', '[music]']
    else:
        cmd += ['-map', '0:v', '-map', '1:a']
    
    cmd += ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2']
    
    cmd += [
        '-fflags', '+genpts', '-flags', '+global_header',
        '-hls_time', '4', '-hls_init_time', '4', '-hls_list_size', '5',
        '-hls_flags', 'independent_segments+omit_endlist',
        '-hls_segment_type', 'mpegts', '-hls_segment_filename', segment_url,
        '-http_persistent', '1', '-method', YOUTUBE_HLS_HTTP_METHOD,
        '-f', 'hls', master_url
    ]
    
    return _run_ffmpeg(cmd)

def _start_rtmp(video_input, filter_str, use_vaapi):
    global ffmpeg_process
    
    cmd = ['ffmpeg', '-hide_banner']
    
    if use_vaapi:
        cmd += ['-init_hw_device', f'vaapi=va:{VAAPI_DEVICE}', '-filter_hw_device', 'va']
    
    cmd += video_input
    
    music_files = get_music_files()
    playlist = create_playlist(music_files)
    using_music = playlist is not None
    
    if using_music:
        cmd += ['-f', 'concat', '-safe', '0', '-stream_loop', '-1', '-i', playlist]
    else:
        cmd += ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']
    
    keyframe = YOUTUBE_FRAMERATE * 2
    
    cmd += ['-vf', filter_str]
    
    if use_vaapi:
        cmd += ['-c:v', 'h264_vaapi', '-profile:v', 'main', '-level', '4.0',
                '-b:v', YOUTUBE_VIDEO_BITRATE, '-maxrate', YOUTUBE_MAXRATE,
                '-bufsize', YOUTUBE_BUFSIZE, '-bf', '2', '-g', str(keyframe)]
    else:
        cmd += [
            '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1',
            '-preset', ENCODER_PRESET, '-tune', 'zerolatency',
            '-b:v', YOUTUBE_VIDEO_BITRATE, '-maxrate', YOUTUBE_MAXRATE, '-bufsize', YOUTUBE_BUFSIZE,
            '-g', str(keyframe), '-keyint_min', str(keyframe), '-sc_threshold', '0',
            '-pix_fmt', 'yuv420p'
        ]
    
    if using_music:
        cmd += ['-filter_complex', f'[1:a]volume={MUSIC_VOLUME}[music]', '-map', '0:v', '-map', '[music]']
    else:
        cmd += ['-map', '0:v', '-map', '1:a']
    
    cmd += ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-f', 'flv', STREAM_URL]
    
    return _run_ffmpeg(cmd)

def _run_ffmpeg(cmd):
    global ffmpeg_process
    try:
        logger.info(f'FFmpeg: {" ".join(cmd[:20])}...')
        ffmpeg_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        def monitor():
            for line in ffmpeg_process.stderr:
                msg = line.strip()
                if any(kw in msg.lower() for kw in ['error', 'failed', 'warning']):
                    logger.info(f'FFmpeg: {msg}')
        
        threading.Thread(target=monitor, daemon=True).start()
        logger.info('Stream started')
        return True
    except Exception as e:
        logger.error(f'FFmpeg failed: {e}')
        return False

def cleanup():
    logger.info('Cleaning up...')
    for proc in [ffmpeg_process, puppeteer_process, xvfb_process]:
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except:
                proc.kill()

def signal_handler(sig, frame):
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    logger.info('Starting streaming service...')
    logger.info(f'{STREAM_PLATFORM} @ {YOUTUBE_OUTPUT_WIDTH}x{YOUTUBE_OUTPUT_HEIGHT}@{YOUTUBE_FRAMERATE}fps')
    
    if os.name != 'nt':
        start_xvfb()
        if not start_puppeteer():
            cleanup()
            sys.exit(1)
        if not wait_for_x_windows(90):
            start_puppeteer()
            if not wait_for_x_windows(90):
                cleanup()
                sys.exit(1)
    
    if not start_stream():
        cleanup()
        sys.exit(1)
    
    try:
        while True:
            if puppeteer_process and puppeteer_process.poll() is not None:
                logger.error('Puppeteer died, restarting...')
                if ffmpeg_process:
                    ffmpeg_process.terminate()
                start_puppeteer()
                wait_for_x_windows(90)
                start_stream()
            
            if os.name != 'nt' and not _has_x_windows():
                logger.error('X window gone, restarting...')
                if ffmpeg_process:
                    ffmpeg_process.terminate()
                if puppeteer_process:
                    puppeteer_process.terminate()
                start_puppeteer()
                wait_for_x_windows(90)
                start_stream()
            
            if ffmpeg_process and ffmpeg_process.poll() is not None:
                logger.error('FFmpeg died, restarting...')
                time.sleep(5)
                if not start_stream():
                    break
            
            time.sleep(10)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()
