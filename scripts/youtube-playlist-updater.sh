#!/bin/bash
# YouTube Playlist Updater for Zachary
# Adds new Abraham Hicks and female partner attraction subliminal videos to "Sleeping" playlist
# Only adds videos published TODAY
# RULES:
#   1. Only female attraction subliminals - NO money/abundance
#   2. Abraham Hicks content allowed
#   3. Delete any videos not matching these topics

CREDS_DIR="/data/.openclaw/workspace/.credentials"
DATA_DIR="/data/.openclaw/workspace/data"
PLAYLIST_ID="PLVToDLczU9Mja5KTzwq-QqNWjeWvUdfdH"
ADDED_VIDEOS_FILE="$DATA_DIR/added_videos.txt"

mkdir -p "$DATA_DIR"
touch "$ADDED_VIDEOS_FILE"

# Load credentials
CLIENT_ID=$(jq -r '.client_id' "$CREDS_DIR/youtube.json")
CLIENT_SECRET=$(jq -r '.client_secret' "$CREDS_DIR/youtube.json")
REFRESH_TOKEN=$(jq -r '.refresh_token' "$CREDS_DIR/youtube_tokens.json")

# Get fresh access token
get_access_token() {
    curl -s -X POST https://oauth2.googleapis.com/token \
        -d "client_id=$CLIENT_ID" \
        -d "client_secret=$CLIENT_SECRET" \
        -d "refresh_token=$REFRESH_TOKEN" \
        -d "grant_type=refresh_token" | jq -r '.access_token'
}

ACCESS_TOKEN=$(get_access_token)

# Today's date at midnight UTC
TODAY_START=$(date -u +%Y-%m-%dT00:00:00Z)

# Search for videos published today only
search_videos() {
    local query="$1"
    curl -s "https://www.googleapis.com/youtube/v3/search?part=snippet&q=$(echo "$query" | sed 's/ /%20/g')&type=video&order=date&maxResults=15&publishedAfter=$TODAY_START&relevanceLanguage=en" \
        -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.items[].id.videoId // empty'
}

# Add video to playlist
add_to_playlist() {
    local video_id="$1"
    
    # Check if already added
    if grep -q "^$video_id$" "$ADDED_VIDEOS_FILE" 2>/dev/null; then
        return 1
    fi
    
    # Add to playlist
    result=$(curl -s -X POST "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"snippet\": {
                \"playlistId\": \"$PLAYLIST_ID\",
                \"resourceId\": {
                    \"kind\": \"youtube#video\",
                    \"videoId\": \"$video_id\"
                }
            }
        }")
    
    if echo "$result" | jq -e '.id' > /dev/null 2>&1; then
        echo "$video_id" >> "$ADDED_VIDEOS_FILE"
        return 0
    fi
    return 1
}

# Get video title
get_video_title() {
    local video_id="$1"
    curl -s "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=$video_id" \
        -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.items[0].snippet.title // "Unknown"'
}

# Check if video is in English
is_english_video() {
    local video_id="$1"
    local details=$(curl -s "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=$video_id" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    local audio_lang=$(echo "$details" | jq -r '.items[0].snippet.defaultAudioLanguage // empty')
    local lang=$(echo "$details" | jq -r '.items[0].snippet.defaultLanguage // empty')
    
    # If language info available, must be English
    if [ -n "$audio_lang" ] && [[ "$audio_lang" != en* ]]; then
        return 1
    fi
    if [ -n "$lang" ] && [[ "$lang" != en* ]]; then
        return 1
    fi
    
    # Also check title for non-Latin characters (Arabic, Hindi, Korean, Chinese, Japanese, Thai, Cyrillic, etc.)
    local title=$(echo "$details" | jq -r '.items[0].snippet.title // ""')
    if echo "$title" | python3 -c "
import sys, unicodedata
t = sys.stdin.read()
non_latin = sum(1 for c in t if ord(c) > 127 and unicodedata.category(c).startswith('L'))
sys.exit(0 if non_latin > len(t)*0.3 else 1)
" 2>/dev/null; then
        return 1
    fi
    
    return 0
}

# Check if title matches allowed topics
is_valid_video() {
    local title="$1"
    title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')
    
    # Abraham Hicks keywords
    if [[ "$title_lower" == *"abraham hicks"* ]] || \
       [[ "$title_lower" == *"abraham-hicks"* ]] || \
       [[ "$title_lower" == *"esther hicks"* ]]; then
        return 0
    fi
    
    # Female attraction keywords (must have subliminal/affirmation AND female-related)
    if [[ "$title_lower" == *"subliminal"* ]] || [[ "$title_lower" == *"affirmation"* ]]; then
        if [[ "$title_lower" == *"women"* ]] || \
           [[ "$title_lower" == *"woman"* ]] || \
           [[ "$title_lower" == *"girl"* ]] || \
           [[ "$title_lower" == *"female"* ]] || \
           [[ "$title_lower" == *"girlfriend"* ]] || \
           [[ "$title_lower" == *"wife"* ]] || \
           [[ "$title_lower" == *"soulmate"* ]] || \
           [[ "$title_lower" == *"love"* ]] || \
           [[ "$title_lower" == *"attract"* ]] || \
           [[ "$title_lower" == *"dating"* ]] || \
           [[ "$title_lower" == *"romantic"* ]] || \
           [[ "$title_lower" == *"relationship"* ]] || \
           [[ "$title_lower" == *"magnetism"* ]] || \
           [[ "$title_lower" == *"irresistible"* ]] || \
           [[ "$title_lower" == *"alpha"* ]] || \
           [[ "$title_lower" == *"masculine"* ]] || \
           [[ "$title_lower" == *"charisma"* ]] || \
           [[ "$title_lower" == *"confident"* ]] || \
           [[ "$title_lower" == *"seduct"* ]] || \
           [[ "$title_lower" == *"crush"* ]] || \
           [[ "$title_lower" == *"desire"* ]] || \
           [[ "$title_lower" == *"partner"* ]]; then
            # Exclude money/abundance
            if [[ "$title_lower" != *"money"* ]] && \
               [[ "$title_lower" != *"wealth"* ]] && \
               [[ "$title_lower" != *"abundance"* ]] && \
               [[ "$title_lower" != *"rich"* ]] && \
               [[ "$title_lower" != *"millionaire"* ]] && \
               [[ "$title_lower" != *"billionaire"* ]] && \
               [[ "$title_lower" != *"financial"* ]] && \
               [[ "$title_lower" != *"success"* ]] && \
               [[ "$title_lower" != *"career"* ]]; then
                return 0
            fi
        fi
    fi
    
    return 1
}

# Get all playlist items and clean up invalid ones
cleanup_playlist() {
    local deleted=0
    local next_page=""
    
    while true; do
        local url="https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=$PLAYLIST_ID&maxResults=50"
        if [ -n "$next_page" ]; then
            url="$url&pageToken=$next_page"
        fi
        
        response=$(curl -s "$url" -H "Authorization: Bearer $ACCESS_TOKEN")
        
        # Process each item
        echo "$response" | jq -c '.items[]?' | while read -r item; do
            local item_id=$(echo "$item" | jq -r '.id')
            local video_id=$(echo "$item" | jq -r '.snippet.resourceId.videoId')
            local title=$(echo "$item" | jq -r '.snippet.title')
            
            if ! is_valid_video "$title" || ! is_english_video "$video_id"; then
                # Delete from playlist
                curl -s -X DELETE "https://www.googleapis.com/youtube/v3/playlistItems?id=$item_id" \
                    -H "Authorization: Bearer $ACCESS_TOKEN"
                echo "DELETED: $title"
                ((deleted++))
            fi
        done
        
        # Check for next page
        next_page=$(echo "$response" | jq -r '.nextPageToken // empty')
        if [ -z "$next_page" ]; then
            break
        fi
    done
    
    echo "CLEANUP_DELETED:$deleted"
}

# Main
ADDED_COUNT=0
ADDED_TITLES=""

# Search terms - Abraham Hicks (expanded)
ABRAHAM_SEARCHES=(
    "Abraham Hicks new"
    "Abraham Hicks 2026"
    "Abraham Hicks love"
    "Abraham Hicks relationship"
    "Abraham Hicks soulmate"
    "Abraham Hicks partner"
    "Abraham Hicks romance"
    "Abraham Hicks attraction"
    "Esther Hicks Abraham"
    "Esther Hicks new"
    "Abraham Hicks desire"
    "Abraham Hicks manifestation love"
)

# Search terms - Female partner attraction (expanded variations)
ATTRACTION_SEARCHES=(
    # Core attraction subliminals
    "attract women subliminal"
    "attract woman subliminal"
    "attract girls subliminal"
    "attract girlfriend subliminal"
    "attract female subliminal"
    "attract wife subliminal"
    "attract soulmate subliminal"
    "attract love subliminal"
    "attract partner subliminal"
    "attraction subliminal"
    
    # Manifest variations
    "manifest girlfriend subliminal"
    "manifest wife subliminal"
    "manifest soulmate subliminal"
    "manifest love subliminal"
    "manifest woman subliminal"
    "manifest dream girl subliminal"
    "manifest relationship subliminal"
    "manifest partner subliminal"
    
    # Get/find variations
    "get girlfriend subliminal"
    "find love subliminal"
    "find soulmate subliminal"
    "find girlfriend subliminal"
    
    # Magnetism/irresistible
    "women magnetism subliminal"
    "female magnetism subliminal"
    "irresistible to women subliminal"
    "magnetic attraction subliminal"
    "become magnetic subliminal"
    
    # Alpha/masculine
    "alpha male subliminal"
    "masculine energy subliminal"
    "masculine attraction subliminal"
    "alpha attraction subliminal"
    "masculine subliminal"
    
    # Confidence/charisma
    "confidence women subliminal"
    "charisma subliminal"
    "charm subliminal"
    "attractive man subliminal"
    "become attractive subliminal"
    
    # Seduction/desire
    "seduction subliminal"
    "women desire you subliminal"
    "women want you subliminal"
    "women approach subliminal"
    "women chase subliminal"
    
    # Dating/romance
    "dating subliminal"
    "romance subliminal"
    "romantic subliminal"
    "love life subliminal"
    
    # Affirmation variations
    "attract women affirmations"
    "girlfriend affirmations"
    "love affirmations sleep"
    "soulmate affirmations"
    "relationship affirmations"
    "attract love affirmations"
    
    # Specific/dream girl
    "dream girl subliminal"
    "ideal woman subliminal"
    "specific person subliminal love"
    "crush subliminal"
    "she loves you subliminal"
    
    # Physical attraction
    "physical attraction subliminal"
    "sexual attraction subliminal"
    "attractive face subliminal"
    "glow up subliminal"
    "handsome subliminal"
    
    # Frequency/energy
    "love frequency"
    "attraction frequency"
    "soulmate frequency"
    "528 hz love"
    "twin flame subliminal"
)

# Run cleanup first
echo "=== CLEANING PLAYLIST ==="
cleanup_playlist

echo ""
echo "=== ADDING NEW VIDEOS ==="

# Run Abraham Hicks searches
for search in "${ABRAHAM_SEARCHES[@]}"; do
    videos=$(search_videos "$search")
    for video_id in $videos; do
        if [ -n "$video_id" ]; then
            title=$(get_video_title "$video_id")
            if is_valid_video "$title" && is_english_video "$video_id" && add_to_playlist "$video_id"; then
                ADDED_TITLES="$ADDED_TITLES\n- $title"
                ((ADDED_COUNT++))
            fi
        fi
    done
done

# Run attraction subliminal searches
for search in "${ATTRACTION_SEARCHES[@]}"; do
    videos=$(search_videos "$search")
    for video_id in $videos; do
        if [ -n "$video_id" ]; then
            title=$(get_video_title "$video_id")
            if is_valid_video "$title" && is_english_video "$video_id" && add_to_playlist "$video_id"; then
                ADDED_TITLES="$ADDED_TITLES\n- $title"
                ((ADDED_COUNT++))
            fi
        fi
    done
done

# Output results
echo ""
echo "=== RESULTS ==="
if [ $ADDED_COUNT -gt 0 ]; then
    echo "ADDED:$ADDED_COUNT"
    echo -e "VIDEOS:$ADDED_TITLES"
else
    echo "ADDED:0 (no new videos today)"
fi
