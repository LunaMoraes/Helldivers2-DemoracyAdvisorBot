const fs = require('fs').promises;
const path = require('path');

// Base URL for the raw JSON files in the community repository
const REPO_BASE = 'https://raw.githubusercontent.com/helldivers-2/json/master/';
const FILES = ['planets.json', 'factions.json', 'sectors.json']; 
const CACHE_DIR = path.join(__dirname, '../cache');

async function initCommunityData() {
    // Ensure the cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    for (const file of FILES) {
        const filePath = path.join(CACHE_DIR, file);
        
        try {
            // Check if the file already exists
            await fs.access(filePath);
            console.log(`[Intel] ${file} already present in local cache. Skipping download.`);
        } catch {
            // File does not exist, fetch it from GitHub
            console.log(`[Intel] Acquiring ${file} from Super Earth archives...`);
            try {
                const response = await fetch(`${REPO_BASE}${file}`);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                
                const data = await response.json();
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                console.log(`[Intel] Successfully saved ${file}.`);
            } catch (error) {
                console.error(`[Intel] Failed to download ${file}:`, error.message);
            }
        }
    }
}

module.exports = { initCommunityData };