FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    xvfb \
    x11vnc \
    fluxbox \
    pulseaudio \
    alsa-utils \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/config /app/logs

# Set up virtual display
ENV DISPLAY=:99

# Run startup script
CMD ["python3", "streaming-service.py"]

