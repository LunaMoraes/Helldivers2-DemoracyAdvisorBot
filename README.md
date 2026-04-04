

file structure:
```
helldivers-bot/
├── data/
│   └── config.json
├── cache/
│   └── apiResults.json       <-- Generated automatically by our script
├── src/
│   ├── apiFetcher.js
│   └── index.js
├── package.json
```


config.json structure:
```
{
  "discordToken": "YOUR_DISCORD_BOT_TOKEN_HERE",
  "clientId": "YOUR_BOT_CLIENT_ID_HERE",
  "apiUrl": "https://api.live.prod.thehelldiversgame.com/api/WarSeason/801/Status"
}
```