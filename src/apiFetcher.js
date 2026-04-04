const fs = require('fs').promises;
const path = require('path');
const config = require('../data/config.json');

const cachePath = path.join(__dirname, '../cache/apiResults.json');
const oldCachePath = path.join(__dirname, '../cache/apiResults_old.json');

async function updateCache() {
    try {
        console.log('Requesting tactical update from Super Earth...');
        
        const response = await fetch(config.apiUrl);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        
        const data = await response.json();
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        
        // --- NEW: BACKUP THE OLD DATA FOR RATE CALCULATIONS ---
        try {
            const currentData = await fs.readFile(cachePath, 'utf-8');
            await fs.writeFile(oldCachePath, currentData);
        } catch (e) {
            // It will fail on the very first run because no cache exists yet. We ignore this.
        }
        
        // Inject a timestamp so our bot knows exactly when this data was pulled
        data._fetchedAt = Date.now();
        
        // Save the new data
        await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
        console.log('Successfully updated cache/apiResults.json');
        
    } catch (error) {
        console.error('Error fetching API data:', error.message);
    }
}

module.exports = { updateCache, cachePath, oldCachePath };