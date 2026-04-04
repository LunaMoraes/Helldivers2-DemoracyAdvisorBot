const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs').promises;
const config = require('../data/config.json');
const { updateCache, cachePath } = require('./apiFetcher');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Update the cache every 5 minutes (300,000 ms)
setInterval(updateCache, 5 * 60 * 1000);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Ready to dispense democracy.`);
    
    // Do an initial fetch upon startup
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
        console.log('Slash commands registered.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'dive') return;

    try {
        // Read directly from the cache file you requested
        const rawData = await fs.readFile(cachePath, 'utf-8');
        const apiResults = JSON.parse(rawData);

        // --- TACTICAL ANALYSIS LOGIC ---
        // The raw API holds player counts in the `planetStatus` array.
        // We will sort them to find the most populated planets.
        const planets = apiResults.planetStatus || [];
        const topPlanets = planets.sort((a, b) => b.players - a.players).slice(0, 3);
        
        let responseMsg = "**Top Priority Planets based on Helldiver deployment:**\n";
        
        topPlanets.forEach((p, i) => {
            // Note: The raw API returns planet IDs, not names! 
            responseMsg += `${i + 1}. Planet Index **${p.index}** - **${p.players.toLocaleString()}** Helldivers active\n`;
        });
        
        responseMsg += "\n*For Super Earth!*";

        await interaction.reply(responseMsg);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Failed to access Super Earth databanks. The cache might be empty.', ephemeral: true });
    }
});

client.login(config.discordToken);