# Mumble deployment (Unraid)

For Unraid users who want to run Mumble separately:

## Option 1: Using Community Applications

1. Open **Community Applications** in Unraid
2. Search for "Mumble" or "Murmur"
3. Install the **mumble-server** container
4. Configure:
   - **Port**: 64738 (TCP and UDP)
   - **SuperUser Password**: Set a secure password
   - **Config Path**: `/mnt/user/appdata/mumble`

## Option 2: Docker Command

```bash
docker run -d \
  --name=mumble-server \
  -p 64738:64738/tcp \
  -p 64738:64738/udp \
  -e MUMBLE_SUPERUSER_PASSWORD=your_secure_password \
  -v /mnt/user/appdata/mumble:/data \
  --restart=unless-stopped \
  mumblevoip/mumble-server:v1.5.915
```

## Option 3: Docker Compose (Standalone)

Create `mumble-docker-compose.yml`:

```yaml
services:
  mumble-server:
    image: mumblevoip/mumble-server:v1.5.915
    container_name: mumble-server
    ports:
      - "64738:64738/tcp"
      - "64738:64738/udp"
    environment:
      - MUMBLE_SUPERUSER_PASSWORD=your_secure_password
    volumes:
      - /mnt/user/appdata/mumble:/data
    restart: unless-stopped
```

Then: `docker compose -f mumble-docker-compose.yml up -d`

## Connecting Mumble to the Stream

1. Install Mumble client on your PC
2. Connect to your Unraid server IP on port 64738
3. Players talk to each other on this server. The stream carries the background music only, not the voice chat.
