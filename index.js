const { 
    Client, GatewayIntentBits, ActionRowBuilder, EmbedBuilder, 
    StringSelectMenuBuilder, PermissionsBitField, AttachmentBuilder 
} = require('discord.js');
const express = require('express');

// --- SERVER WEB PER CRON-JOB (SIMILE A FLASK) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('GVRM Bot este ONLINE și funcționează!'); // Messaggio che vedrà Cron-job
});

app.listen(PORT, () => {
    console.log(`Serverul web pornit pe portul ${PORT}`);
});

// --- LOGICA DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let staffRoleId = null; // Memorizzato in RAM (si resetta al riavvio su Render Free)

client.once('ready', () => {
    console.log(`✅ Autentificat ca ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // Setup Ruolo Staff
        if (commandName === 'setup') {
            const role = interaction.options.getRole('role');
            staffRoleId = role.id;
            return interaction.reply({ content: `✅ Rolul de staff a fost setat: **${role.name}**`, ephemeral: true });
        }

        // Pannello Ticket
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
                .setTitle('📩 Centrul de Suport GVRM')
                .setDescription('Salut! Te rugăm să alegi o categorie pentru a deschide un tichet.')
                .setColor('#00ff00');

            return interaction.reply({ embeds: [embed], components: [menu] });
        }

        // Chiudi Ticket
        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply('Acesta nu este un tichet!');
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
            await interaction.channel.setName(`closed-${interaction.channel.name.split('-')[1]}`);
            return interaction.reply('🔒 **Tichet închis.** Folosește `/delete` pentru ștergere.');
        }

        // Elimina Ticket
        if (commandName === 'delete') {
            if (!interaction.channel.name.startsWith('closed-')) return interaction.reply('Închide tichetul prima dată!');
            await interaction.reply('Se șterge...');
            setTimeout(() => interaction.channel.delete(), 3000);
        }

        // Transcript
        if (commandName === 'transcript') {
            const messages = await interaction.channel.messages.fetch();
            let log = `TRANSCRIPT GVRM - ${interaction.channel.name}\n\n`;
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
        await channel.send({ content: `Salut ${interaction.user}! Categoria aleasă: **${category}**. Așteaptă un membru Staff.` });
    }
});

// Registrazione Comandi Slash
client.on('ready', async () => {
    const commands = [
        { name: 'setup', description: 'Setează rolul staff', options: [{ name: 'role', type: 8, description: 'Alege rolul', required: true }] },
        { name: 'send', description: 'Trimite panoul' },
        { name: 'close', description: 'Închide tichetul' },
        { name: 'delete', description: 'Șterge tichetul' },
        { name: 'transcript', description: 'Descarcă chat-ul' },
    ];
    await client.application.commands.set(commands);
});

client.login(process.env.TOKEN);
