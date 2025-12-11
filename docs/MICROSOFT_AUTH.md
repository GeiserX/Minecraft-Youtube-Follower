# Microsoft Account Authentication

## Important: No Password Required!

Since your Minecraft account (`your_username`) is a Microsoft account, **you do not need to provide a password**. The bot uses Microsoft OAuth device code flow.

## How It Works

1. **First Run**: The bot will display a device code and URL
2. **You Visit**: The URL in your browser
3. **You Enter**: The device code
4. **You Sign In**: With your Microsoft account
5. **Tokens Cached**: Authentication tokens are saved for future use

## Setup Process

### Step 1: Run the Bot

When you first run the bot, you'll see output like:

```
============================================================
MICROSOFT ACCOUNT AUTHENTICATION REQUIRED
============================================================
Go to: https://microsoft.com/devicelogin
Enter code: ABC123XYZ
============================================================
This is a one-time setup. Tokens will be cached.
============================================================
```

### Step 2: Complete Authentication

1. Open the URL in your browser
2. Enter the code shown
3. Sign in with your Microsoft account (`your_username`)
4. Grant permissions if prompted

### Step 3: Tokens Are Cached

After successful authentication, tokens are saved to `/app/config/.auth` (or `./bot/config/.auth` if running locally). The bot will use these cached tokens for all future runs.

## Environment Variables

In your `.env` file, you only need:

```env
MINECRAFT_USERNAME=your_username
# NO PASSWORD NEEDED!
```

The `MINECRAFT_PASSWORD` variable is **not used** for Microsoft accounts and can be removed.

## Troubleshooting

### "Authentication error" on first run

- Make sure you complete the device code flow
- Check that you're signed in with the correct Microsoft account
- Ensure the account has Minecraft Java Edition

### "Token expired" error

- Delete the cached tokens: `rm -rf ./bot/config/.auth`
- Run the bot again to re-authenticate

### Running in Docker

The authentication cache is stored in the volume mount (`./bot/config:/app/config`), so tokens persist across container restarts.

## Security Notes

- Tokens are stored locally in the container volume
- Never commit the `.auth` directory to git (already in .gitignore)
- Tokens are specific to your account and server
- If tokens are compromised, revoke them in Microsoft account settings


