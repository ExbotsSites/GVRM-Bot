
const { 
    Client, GatewayIntentBits, ActionRowBuilder, EmbedBuilder, 
    StringSelectMenuBuilder, PermissionsBitField, AttachmentBuilder 
} = require('discord.js');
const express = require('express');

// --- SERVER WEB PER CRON-JOB ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('GVRM Bot este ONLINE!');
});

app.listen(PORT, () => {
    console.log(`Server web pornit pe portul ${PORT}`);
});

// --- LOGICA DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// Variabile temporanea per lo Staff Role
let staffRoleId = null;

client.once('ready', async () => {
    console.log(`✅ Autentificat ca ${client.user.tag}`);
    
    // Registrazione comandi
    const commands = [
        { name: 'setup', description: 'Setează rolul staff', options: [{ name: 'role', type: 8, description: 'Alege rolul', required: true }] },
        { name: 'send', description: 'Trimite panoul de tichete' },
        { name: 'help', description: 'Vezi toate comenzile' },
        { name: 'close', description: 'Închide tichetul' },
        { name: 'delete', description: 'Șterge tichetul' },
        { name: 'transcript', description: 'Descarcă chat-ul' },
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

        if (commandName === 'help') {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Comenzi GVRM')
                    .setDescription('`/setup` - Setează staff\n`/send` - Trimite panoul\n`/close` - Închide ticket\n`/delete` - Șterge ticket\n`/transcript` - Salvează chat')
                    .setColor('#5865F2')]
            });
        }

        if (commandName === 'setup') {
            const role = interaction.options.getRole('role');
            staffRoleId = role.id;
            return interaction.reply({ content: `✅ Rolul staff a fost setat: **${role.name}**`, ephemeral: true });
        }

        if (commandName === 'send') {
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
                .setDescription('Selectează o categorie de mai jos per a deschide un tichet.')
                .setColor('#00ff00');
            return interaction.reply({ embeds: [embed], components: [menu] });
        }

        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply('Nu este un tichet!');
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1]}`);
            return interaction.reply('🔒 Tichet închis.');
        }

        if (commandName === 'delete') {
            if (!interaction.channel.name.startsWith('closed-')) return interaction.reply('Închide tichetul mai întâi!');
            await interaction.reply('Se șterge...');
            setTimeout(() => interaction.channel.delete(), 3000);
        }

        if (commandName === 'transcript') {
            const messages = await interaction.channel.messages.fetch();
            let log = `TRANSCRIPT GVRM\n\n`;
            messages.reverse().forEach(m => {
                log += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
            });
            const file = new AttachmentBuilder(Buffer.from(log, 'utf-8'), { name: `transcript.txt` });
            return interaction.reply({ files: [file] });
        }
    }

    // Creazione Canale Ticket
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
        await channel.send({ content: `Salut ${interaction.user}! Categoria: **${category}**.` });
    }
});

client.login(process.env.TOKEN);
