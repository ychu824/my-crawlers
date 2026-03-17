#!/bin/bash
set -e

PROJECT_DIR="$(pwd)"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Directory $PROJECT_DIR does not exist. Please clone the repository first."
    exit 1
fi

cd "$PROJECT_DIR"

echo "Fetching latest code from main..."
git pull origin main

echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3.12-venv

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
sudo cp my-crawlers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-crawlers.service

echo "Restarting tracker service..."
sudo systemctl restart my-crawlers.service

echo "Deployment finished successfully!"
