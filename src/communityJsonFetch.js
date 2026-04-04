const fs = require('fs').promises;
const path = require('path');

// Base URL for the raw JSON files in the community repository
const REPO_BASE = 'https://raw.githubusercontent.com/helldivers-2/json/master/';

// Updated paths matching the exact repository structure
const FILES = [
    'factions.json',
    'planets/planets.json',
    'planets/biomes.json',
    'planets/environmentals.json',
    'planets/planetRegion.json',
    'assignments/reward/type.json',
    'effects/planetEffects.json',
    'items/item_names.json' 
]; 

const CACHE_DIR = path.join(__dirname, '../cache');

async function initCommunityData() {
    await fs.mkdir(CACHE_DIR, { recursive: true });

    for (const fileRoute of FILES) {
        // fileRoute maps to the exact folder path (e.g., "effects/planetEffects.json")
        const localPath = path.join(CACHE_DIR, fileRoute);
        const localDir = path.dirname(localPath);
        
        try {
            // Ensure the specific sub-folders exist before saving
            await fs.mkdir(localDir, { recursive: true });

            // Check if we already downloaded it
            await fs.access(localPath);
            console.log(`[Intel] ${fileRoute} already secured in local cache.`);
        } catch {
            console.log(`[Intel] Acquiring ${fileRoute} from Super Earth archives...`);
            try {
                const response = await fetch(`${REPO_BASE}${fileRoute}`);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                
                const data = await response.json();
                await fs.writeFile(localPath, JSON.stringify(data, null, 2));
                console.log(`[Intel] Successfully saved ${fileRoute}.`);
            } catch (error) {
                console.error(`[Intel] Failed to download ${fileRoute}:`, error.message);
            }
        }
    }
}

module.exports = { initCommunityData };