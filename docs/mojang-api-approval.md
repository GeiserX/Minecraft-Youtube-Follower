# Mojang API approval

## Why the bot cannot join

An "Invalid app registration" error is not about the Azure configuration or Xbox Live permissions. Mojang approves every new third-party application by hand before it can use the Minecraft Java Edition APIs, and an app that is not on Mojang's allow list is refused at sign-in. That is why an Azure registration that looks correct still fails, and why the Xbox Live permission is not offered in a standard registration.

## What Mojang requires

Your Azure app's client ID has to be on Mojang's allow list. Nothing in this repository can work around that.

## How to apply

1. Go to <https://help.minecraft.net/>.
2. Search for "Java Edition Game Service API Review" or "API integration request", and open the form the article links ("new applications must request access via this form"). If you cannot find it, contact Minecraft support.
3. Fill it in with the details below and submit.
4. Wait for the review; it can take days or weeks. Once approved, restart the bot and sign it in as [Getting started](getting-started.md#6-sign-the-bot-in) describes.

## What to include

- Application name: MinecraftBot, or your bot's name
- Type and purpose: an automated spectator bot that follows players for 24/7 YouTube or Twitch streaming
- Azure client ID: your `AZURE_CLIENT_ID`
- Authentication: Microsoft OAuth, device code flow, through prismarine-auth and mineflayer
- Developer information: your contact details
- Why it is safe: it signs in through Microsoft, only watches in spectator mode, collects no user data, and the source is public
