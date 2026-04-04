const fs = require('fs').promises;
const path = require('path');
const config = require('../data/config.json');

const cachePath = path.join(__dirname, '../cache/apiResults.json');

async function updateCache() {
    try {
        console.log('Requesting tactical update from Super Earth...');
        
        const response = await fetch(config.apiUrl);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        
        const data = await response.json();
        
        // Ensure the cache directory exists before writing
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        
        // Save the results to your specified JSON file
        await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
        console.log('Successfully updated cache/apiResults.json');
        
    } catch (error) {
        console.error('Error fetching API data:', error.message);
        // If you hit SSL errors with the raw URL, consider swapping to api.helldivers2.dev!
    }
}

module.exports = { updateCache, cachePath };