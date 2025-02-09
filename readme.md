# Calendar Availability Tool

A Chrome extension that helps you quickly generate availability text from your Google Calendar. Perfect for scheduling meetings and sharing your available time slots.

## Features

- Pulls availability directly from Google Calendar (note: unaccepted mtgs count as busy)
- Customizable time ranges
- Support for multiple timezones
- Weekend toggling
- Automatic clipboard copying
- Preferences saving

## Installation

1. Clone this repository or download the files

2. Copy `manifest.template.json` to `manifest.json`

3. Set up Google Calendar API:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable the Google Calendar API
   - Create OAuth 2.0 credentials for Chrome Extension
   - Replace `YOUR_CLIENT_ID` in manifest.json with your actual client ID

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the extension directory

## Usage

1. Click the extension icon in Chrome
2. Set your preferred:
   - Available hours
   - Timezone for availability
   - Display timezone
   - Weekend inclusion preference
3. Click "Generate Availability"
4. The extension will:
   - Generate your availability text
   - Copy it to your clipboard
   - Show the result in the popup

## Files

- `manifest.template.json`: Extension configuration (with OAuth client ID placeholder)
- `popup.html`: Extension UI
- `popup.js`: Main logic
- `background.js`: Background script for shortcuts
- `icons/`: Extension icons

## Development

To modify the extension:
1. Make your changes
2. Reload the extension in `chrome://extensions/`
3. Test the changes

## Notes

- The extension requires Google Calendar API access
- It only reads your calendar (no write permissions)
- Preferences are saved between sessions