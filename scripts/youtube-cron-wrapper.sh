#!/bin/bash
# Wrapper for YouTube playlist updater - sends notification to Zachary

SCRIPT_DIR="/root/clawd/scripts"
LOG_FILE="/root/clawd/data/youtube-update-$(date +%Y%m%d-%H%M%S).log"

# Run the updater
output=$("$SCRIPT_DIR/youtube-playlist-updater.sh" 2>&1)
echo "$output" > "$LOG_FILE"

# Parse results
added_count=$(echo "$output" | grep "^ADDED:" | cut -d: -f2)

if [ "$added_count" -gt 0 ]; then
    # Extract video titles
    videos=$(echo "$output" | grep "^- " | head -5)
    
    # Notify via Clawdbot
    message="**YouTube Update:** $added_count new video(s) added to Sleeping playlist."
    if [ -n "$videos" ]; then
        message="$message

$videos"
    fi
    
    # Write to notification file for Aurelia to pick up
    echo "$message" > /root/clawd/data/youtube-notification.txt
    echo "NOTIFY" >> /root/clawd/data/youtube-notification.txt
fi
