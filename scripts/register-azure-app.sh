#!/bin/bash
# Quick script to help with Azure app registration

echo "=========================================="
echo "Azure App Registration Helper"
echo "=========================================="
echo ""
echo "This will open Azure Portal for you."
echo "Just follow these simple steps:"
echo ""
echo "1. Click 'New registration'"
echo "2. Name: MinecraftBot"
echo "3. Account type: 'Personal Microsoft accounts only'"
echo "4. Click 'Register'"
echo "5. Copy the 'Application (client) ID'"
echo ""
read -p "Press Enter to open Azure Portal..."
open "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
echo ""
echo "After you copy your Client ID, paste it here:"
read -p "Client ID: " client_id
if [ ! -z "$client_id" ]; then
    echo ""
    echo "Adding to .env file..."
    if grep -q "AZURE_CLIENT_ID" .env 2>/dev/null; then
        sed -i.bak "s/^AZURE_CLIENT_ID=.*/AZURE_CLIENT_ID=$client_id/" .env
        echo "✓ Updated AZURE_CLIENT_ID in .env"
    else
        echo "AZURE_CLIENT_ID=$client_id" >> .env
        echo "✓ Added AZURE_CLIENT_ID to .env"
    fi
    echo ""
    echo "Done! Now restart the bot:"
    echo "  docker-compose restart minecraft-spectator-bot"
else
    echo "No client ID provided. You can add it manually to .env later."
fi
