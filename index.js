const { 
    Client, GatewayIntentBits, ActionRowBuilder, EmbedBuilder, 
    StringSelectMenuBuilder, PermissionsBitField, AttachmentBuilder 
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('GVRM Bot ONLINE'));
app.listen(PORT);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let staffRoleId = null;

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
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
    } catch (e) {
        console.error('❌ Eroare:', e);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup') {
            const role = interaction.options.getRole('role');
            staffRoleId = role.id;
            return interaction.reply({ content: `✅ Staff setat: **${role.name}**`, ephemeral: true });
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
                .setDescription('Alege o categorie mai jos.')
                .setColor('#00ff00');
            return interaction.reply({ embeds: [embed], components: [menu] });
        }

        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply('Nu e ticket!');
            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1]}`);
            return interaction.reply('🔒 Închis.');
        }

        if (commandName === 'delete') {
            if (!interaction.channel.name.startsWith('closed-')) return interaction.reply('Închide-l întâi!');
            await interaction.reply('Ștergere...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: staffRoleId || interaction.guild.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ],
        });
        await interaction.reply({ content: `✅ Creat: ${channel}`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
