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
    await interaction.deferReply();

    try {
        // Load Current Data
        const rawApiData = await fs.readFile(path.join(__dirname, '../cache/apiResults.json'), 'utf-8');
        const apiResults = JSON.parse(rawApiData);
        
        // Load Historical Data (for math)
        let oldApiResults = null;
        try {
            const rawOldData = await fs.readFile(path.join(__dirname, '../cache/apiResults_old.json'), 'utf-8');
            oldApiResults = JSON.parse(rawOldData);
        } catch (e) { /* Might not exist on first boot */ }

        // Load Community JSONs
        const readCache = async (filePath) => {
            try { return JSON.parse(await fs.readFile(path.join(__dirname, `../cache/${filePath}`), 'utf-8')); } 
            catch { return {}; } 
        };
        const planetsDict = await readCache('planets/planets.json');
        const biomesDict = await readCache('planets/biomes.json');
        const envsDict = await readCache('planets/environmentals.json');
        
        const planetStatuses = apiResults.planetStatus || [];
        const topPlanets = planetStatuses.sort((a, b) => b.players - a.players).slice(0, 3);
        const embedsArray = [];

        for (let i = 0; i < topPlanets.length; i++) {
            const p = topPlanets[i];
            const planetInfo = findData(planetsDict, p.index) || {};
            const faction = FACTION_INFO[p.owner] || { name: 'Unknown Force', color: '#808080' };
            
            const planetName = planetInfo.name || `Planet ${p.index}`;
            const sectorName = planetInfo.sector || "Unknown Sector";
            
            // --- LIBERATION & ETA MATH ---
            const maxHealth = p.maxHealth || 1000000;
            const currentHealth = p.health || 0;
            const liberationProgress = 100 - ((currentHealth / maxHealth) * 100); 

            let rateString = "🟡 Calculating... (Awaiting next sync)";
            let etaString = "Unknown";

            if (oldApiResults && oldApiResults._fetchedAt && apiResults._fetchedAt) {
                const oldPlanet = (oldApiResults.planetStatus || []).find(op => op.index === p.index);
                if (oldPlanet) {
                    const timeDiffMs = apiResults._fetchedAt - oldApiResults._fetchedAt;
                    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

                    if (timeDiffHours > 0) {
                        const healthDifference = oldPlanet.health - currentHealth;
                        const healthPerHour = healthDifference / timeDiffHours;
                        const percentPerHour = (healthPerHour / maxHealth) * 100;

                        if (percentPerHour > 0) {
                            rateString = `🟢 +${percentPerHour.toFixed(2)}%/hr`;
                            const hoursRemaining = currentHealth / healthPerHour;
                            etaString = `Approx. ${hoursRemaining.toFixed(1)} hours`;
                        } else if (percentPerHour < 0) {
                            rateString = `🔴 ${percentPerHour.toFixed(2)}%/hr`;
                            etaString = `Losing ground`;
                        } else {
                            rateString = `⚪ 0.00%/hr (Stalemate)`;
                            etaString = `N/A`;
                        }
                    }
                }
            }

            // --- WEATHER LOGIC ---
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

            // --- EMBED BUILDER ---
            const planetEmbed = new EmbedBuilder()
                .setTitle(`Priority Target #${i + 1}: ${planetName}`)
                .setDescription(`Located in the **${sectorName}**`)
                .setColor(faction.color)
                .addFields(
                    { name: '💀 Occupying Force', value: faction.name, inline: true },
                    { name: '👥 Active Helldivers', value: p.players.toLocaleString(), inline: true },
                    { name: '📊 Liberation Status', value: `**Progress:** ${liberationProgress.toFixed(3)}%\n**Rate:** ${rateString}\n**ETA:** ${etaString}`, inline: false },
                    { name: '⛈️ Planetary Conditions', value: conditionsText, inline: false }
                );

            if (i === topPlanets.length - 1) {
                planetEmbed.setFooter({ text: 'Data synced directly from the Galactic War Map' })
                           .setTimestamp();
            }

            embedsArray.push(planetEmbed);
        }

        await interaction.editReply({ embeds: embedsArray });

    } catch (error) {
        console.error("Command Execution Error:", error);
        await interaction.editReply({ content: '❌ Failed to access Super Earth databanks. Intel is currently unavailable.' });
    }
});

client.login(config.discordToken);