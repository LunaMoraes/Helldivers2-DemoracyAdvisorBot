const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../data/config.json')

// Import our custom modules
const { updateCache, cachePath } = require('./apiFetcher');
const { initCommunityData } = require('./communityJsonFetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Update the live war status every 5 minutes
setInterval(updateCache, 5 * 60 * 1000);

// --- HELPER FUNCTION: Robust JSON Search ---
function findData(cacheObject, idValue) {
    if (!cacheObject) return null;
    if (Array.isArray(cacheObject)) {
        return cacheObject.find(item => item.index == idValue || item.id == idValue);
    }
    return cacheObject[idValue.toString()] || 
           Object.values(cacheObject).find(item => item.index == idValue || item.id == idValue);
}

// --- STATIC FACTION MAPPING ---
// Bypassing the JSON lookup for factions guarantees 100% accuracy and lets us easily attach hex colors.
const FACTION_INFO = {
    1: { name: 'Super Earth', color: '#0058E3' }, // SEAF Blue
    2: { name: 'Terminids', color: '#FFE800' },   // Bug Yellow
    3: { name: 'Automatons', color: '#FF0000' },  // Bot Red
    4: { name: 'Illuminate', color: '#9C27B0' }   // Squid Purple
};

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

// --- COMMAND LOGIC ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'dive') return;

    // Acknowledge the command immediately to prevent Discord's timeout
    await interaction.deferReply();

    try {
        const rawApiData = await fs.readFile(path.join(__dirname, '../cache/apiResults.json'), 'utf-8');
        const apiResults = JSON.parse(rawApiData);
        
        const readCache = async (filePath) => {
            try { return JSON.parse(await fs.readFile(path.join(__dirname, `../cache/${filePath}`), 'utf-8')); } 
            catch { return {}; } 
        };

        const planetsDict = await readCache('planets/planets.json');
        const biomesDict = await readCache('planets/biomes.json');
        const envsDict = await readCache('planets/environmentals.json');
        
        const planetStatuses = apiResults.planetStatus || [];
        const topPlanets = planetStatuses.sort((a, b) => b.players - a.players).slice(0, 3);
        
        // This array will hold our 3 separate embedded cards
        const embedsArray = [];

        for (let i = 0; i < topPlanets.length; i++) {
            const p = topPlanets[i];
            
            const planetInfo = findData(planetsDict, p.index) || {};
            
            // Map the p.owner integer directly to our hardcoded object above
            const faction = FACTION_INFO[p.owner] || { name: 'Unknown Force', color: '#808080' };
            
            const planetName = planetInfo.name || `Planet ${p.index}`;
            const sectorName = planetInfo.sector || "Unknown Sector";
            
            let conditionsText = "Standard Conditions";
            if (planetInfo.biome) {
                const biomeInfo = findData(biomesDict, planetInfo.biome) || { name: planetInfo.biome };
                conditionsText = `**Biome:** ${biomeInfo.name}\n`;
            }
            if (planetInfo.environmentals && planetInfo.environmentals.length > 0) {
                const envNames = planetInfo.environmentals.map(env => {
                    const e = findData(envsDict, env);
                    return e ? e.name : env;
                });
                conditionsText += `**Hazards:** ${envNames.join(', ')}`;
            }

            // Construct a distinct embed for THIS specific planet
            const planetEmbed = new EmbedBuilder()
                .setTitle(`Priority Target #${i + 1}: ${planetName}`)
                .setDescription(`Located in the **${sectorName}**`)
                // Set the color dynamically based on the faction!
                .setColor(faction.color)
                .addFields(
                    { name: '💀 Occupying Force', value: faction.name, inline: true },
                    { name: '👥 Active Helldivers', value: p.players.toLocaleString(), inline: true },
                    { name: '⛈️ Planetary Conditions', value: conditionsText, inline: false }
                );

            // Add the Super Earth footer and timestamp ONLY to the very last card so it looks clean
            if (i === topPlanets.length - 1) {
                planetEmbed.setFooter({ text: 'Data synced directly from the Galactic War Map' })
                           .setTimestamp();
            }

            // Push this card into our array
            embedsArray.push(planetEmbed);
        }

        // Send all three embeds at once!
        await interaction.editReply({ embeds: embedsArray });

    } catch (error) {
        console.error("Command Execution Error:", error);
        await interaction.editReply({ content: '❌ Failed to access Super Earth databanks. Intel is currently unavailable.' });
    }
});

client.login(config.discordToken);