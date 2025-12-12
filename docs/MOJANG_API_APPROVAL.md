# Mojang API Approval Required

## The Real Problem

The "Invalid app registration" error is **NOT** about Azure configuration or Xbox Live permissions. 

**Mojang now requires all new third-party applications to be manually approved** before they can access Minecraft Java Edition APIs. Your application needs to be added to Mojang's allow list.

## What This Means

- ✅ Your Azure app registration is probably correct
- ✅ Xbox Live permission might not be needed
- ❌ **Your app needs Mojang approval first**

## How to Request Approval

### Step 1: Find the Application Form

Based on the Minecraft help page you found, there should be a form to request API access. The page mentions:
> "new applications must request access via this form"

**Look for:**
- A link to an application/review form on the Minecraft help page
- Or search: "Minecraft Java Edition API integration request form"
- Or contact Minecraft support directly

### Step 2: Fill Out the Application

You'll likely need to provide:
- **Application Name**: MinecraftBot (or your bot name)
- **Purpose**: Automated spectator bot for streaming
- **Description**: Explain what your bot does (follows players, streams to YouTube/Twitch)
- **Azure App Client ID**: `your-azure-client-id-here`
- **Developer Information**: Your contact details
- **Use Case**: 24/7 automated streaming of Minecraft server

### Step 3: Wait for Approval

- Mojang will review your application
- This may take some time (days/weeks)
- Once approved, your app will be added to the allow list
- Then authentication should work

## What to Include in Your Application

**Application Details:**
- Name: MinecraftBot
- Type: Automated spectator bot
- Purpose: Follow players in spectator mode for 24/7 streaming

**Technical Details:**
- Azure Client ID: `your-azure-client-id-here`
- Authentication: Microsoft OAuth (device code flow)
- Library: prismarine-auth / mineflayer
- Use case: Automated YouTube/Twitch streaming

**Why It's Safe:**
- Uses official Microsoft authentication
- Only accesses spectator mode (read-only)
- No user data collection
- Open source / transparent

## Alternative: Check if Form Link Exists

The Minecraft help page should have a link to the application form. Look for:
- "Request access via this form" link
- "API integration request" link
- Contact support link

## Next Steps

1. **Find the application form** on the Minecraft help page
2. **Fill it out** with your app details
3. **Submit and wait** for Mojang approval
4. **Once approved**, restart the bot and it should work

## This Explains Everything!

This is why:
- Azure app registration seemed correct but still failed
- Xbox Live permission wasn't available
- The error was "Invalid app registration" (Mojang rejecting it, not Azure)

Your Azure setup is probably fine - you just need Mojang's approval first!

