## ChronoSnap

ChronoSnap is a Chrome Extension that matches your Google Drive files with Google Calendar events, helping you organize documents, notes, and media by event timelines.

### Features

- Fetches Google Calendar events, tasks, and appointments.
- Lists all your Google Drive files.
- Matches files to calendar items based on dates.
- Lets you view files grouped under each event.
- Search or select calendar events to see related files.

### Load the Extension

1. Go to `chrome://extensions` in Chrome.
2. Enable **Developer Mode**.
3. Click **Load unpacked**.
4. Select the `chronosnap/` folder.

### Google API Setup

ChronoSnap uses Google APIs for Drive, Calendar, and Tasks. The extension’s `manifest.json` contains an example OAuth client ID.

> **Important for Public Use:**  
> The included OAuth client ID is shared for development purposes only. If you plan to deploy your own copy of ChronoSnap:
>
> - Create your own OAuth 2.0 Client ID in Google Cloud Console.
> - Replace the client ID in `manifest.json`:
>
> ```json
> "oauth2": {
>   "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
>   "scopes": [...]
> }
> ```
>
> Otherwise, your extension may use someone else’s API quota.

### How to Download This Repo

If you want to clone and try ChronoSnap:

```bash
git clone https://github.com/SShivanjali/chronosnap.git
cd chronosnap
```

Then load it via chrome://extensions.

### Privacy Note
ChronoSnap only fetches your files and calendar data locally in your browser and does not store or send your personal data anywhere else.
