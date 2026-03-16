#!/bin/bash
set -e

# Determine the directory where this script is located
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CURRENT_USER=$(whoami)

echo "Project directory: $PROJECT_DIR"
echo "Current user: $CURRENT_USER"

cd "$PROJECT_DIR"

echo "Fetching latest code from main..."
git pull origin main

echo "Updating Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
# Ensure playwright browsers and system dependencies are installed
playwright install --with-deps chromium

echo "Updating Node.js dependencies..."
cd tracker
npm install
cd ..

echo "Configuring systemd service..."
# Create a temporary service file with replaced placeholders
TEMP_SERVICE_FILE=$(mktemp)
sed -e "s|{{PROJECT_DIR}}|$PROJECT_DIR|g" \
    -e "s|{{USER}}|$CURRENT_USER|g" \
    my-crawlers.service > "$TEMP_SERVICE_FILE"

sudo cp "$TEMP_SERVICE_FILE" /etc/systemd/system/my-crawlers.service
rm "$TEMP_SERVICE_FILE"

sudo systemctl daemon-reload
sudo systemctl enable my-crawlers.service

echo "Restarting tracker service..."
sudo systemctl restart my-crawlers.service

echo "Deployment finished successfully!"
