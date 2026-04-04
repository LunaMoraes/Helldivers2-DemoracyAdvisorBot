const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../data/config.json');

// Import our custom modules
const { updateCache, cachePath } = require('./apiFetcher');
const { initCommunityData } = require('./communityJsonFetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Update the live war status every 5 minutes
setInterval(updateCache, 5 * 60 * 1000);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Ready to dispense democracy.`);
    
    // 1. Check for and download static community JSON data
    await initCommunityData();
    
    // 2. Fetch the live war API data
    await updateCache(); 

    // Register the /dive command with Discord
    const rest = new REST({ version: '10' }).setToken(config.discordToken);
    try {
        await rest.put(Routes.applicationCommands(config.clientId), {
            body: [{
                name: 'dive',
                description: 'Suggests the best planets to dive on for Super Earth!',
            }]
        });
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'dive') return;

    try {
        // Read live API status
        const rawApiData = await fs.readFile(cachePath, 'utf-8');
        const apiResults = JSON.parse(rawApiData);
        
        // Read our newly downloaded community planets data
        const planetsPath = path.join(__dirname, '../cache/planets.json');
        const rawPlanetsData = await fs.readFile(planetsPath, 'utf-8').catch(() => '{}');
        const planetDictionary = JSON.parse(rawPlanetsData);

        const planets = apiResults.planetStatus || [];
        // Sort by player count descending, take top 3
        const topPlanets = planets.sort((a, b) => b.players - a.players).slice(0, 3);
        
        let responseMsg = "**Top Priority Planets based on current deployment:**\n\n";
        
        topPlanets.forEach((p, i) => {
            // The community planets.json uses the index ID as the object key (e.g., "4", "32")
            const planetInfo = planetDictionary[p.index.toString()];
            
            // Fallback to "Unknown Planet" if it's not in the JSON yet
            const planetName = planetInfo ? planetInfo.name : `Unknown Sector (ID: ${p.index})`;
            const sectorName = planetInfo ? planetInfo.sector : "Unknown Space";
            
            responseMsg += `**${i + 1}. ${planetName}** (${sectorName})\n`;
            responseMsg += `↳ Active Helldivers: **${p.players.toLocaleString()}**\n\n`;
        });
        
        responseMsg += "*For Super Earth!*";

        await interaction.reply(responseMsg);
    } catch (error) {
        console.error("Command Execution Error:", error);
        await interaction.reply({ 
            content: 'Failed to access Super Earth databanks. Ensure the API cache is populated.', 
            ephemeral: true 
        });
    }
});

client.login(config.discordToken);