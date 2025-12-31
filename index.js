const { 
    Client, GatewayIntentBits, ActionRowBuilder, EmbedBuilder, 
    StringSelectMenuBuilder, PermissionsBitField, AttachmentBuilder 
} = require('discord.js');
const express = require('express');

// --- 1. SERVER WEB PER CRON-JOB ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('GVRM Bot este ONLINE!');
});

app.listen(PORT, () => {
    console.log(`✅ Server web activ pe portul ${PORT}`);
});

// --- 2. CONFIGURAZIONE DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let staffRoleId = null; // Memorizzato in RAM

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
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
        console.error('❌ Eroare la înregistrarea comenzilor:', error);
    }
});

client.on('interactionCreate', async interaction => {
    // Gestione Comandi Slash
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            const role = interaction.options.getRole('role');
            staffRoleId = role.id;
            return interaction.reply({ content: `✅ Rolul staff a fost setat: **${role.name}**`, ephemeral: true });
        }

        if (commandName === 'send') {
            // Usiamo deferReply per evitare l'errore "Unknown Interaction"
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
                .setTitle('📩 Suport GVRM')
                .setDescription('Selectează o categorie de mai jos pentru a deschide un tichet.')
                .setColor('#00ff00');

            return interaction.editReply({ embeds: [embed], components: [menu] });
        }

        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply('Acesta nu este un tichet!');
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1] || 'user'}`);
            return interaction.reply('🔒 **Tichet închis.**');
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

    // Gestione Creazione Ticket (Select Menu)
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

        await interaction.reply({ content: `✅ Tichet creat: ${channel}`, ephemeral: true });
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🆘 Tichet ${category}`)
            .setDescription(`Salut ${interaction.user}, echipa staff te va ajuta imediat. Descrie problema ta qui.`)
            .setColor('#f1c40f');

        await channel.send({ embeds: [welcomeEmbed] });
    }
});

client.login(process.env.TOKEN);
