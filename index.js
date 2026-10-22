require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  Events,
} = require('discord.js');

// --- Bot setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// --- Constants ---
const VERIFY_BUTTON_ID = 'verify_button';
const VERIFY_MODAL_ID = 'verify_modal';
const NAME_INPUT_ID = 'verify_name_input';

// --- Ready event ---
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  // Register slash command (/verify-setup) — guild-scoped for instant update during testing
  const verifyCommand = new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('Post the verification panel with a Verify button.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  c.application.commands.commands.set([], []); // safety
  c.guilds.cache.get(process.env.GUILD_ID)?.commands.set([verifyCommand])
    .then(() => console.log('✅ Slash command registered (/verify-setup)'))
    .catch((err) => console.error('❌ Failed to register command:', err));
});

// --- Interaction handler ---
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 1) Slash command: /verify-setup
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify-setup') {
      const embed = new EmbedBuilder()
       .setTitle('✅ Verification')
       setDescription('Click the **Verify** button below to set your nickname.')
       setColor(0x5865F2)
        .setFooter({ text: 'Verification System' });

      const button = new ButtonBuilder()
        .setCustomId(VERIFY_BUTTON_ID)
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝');

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // 2) Button click: open the modal
    if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) {
      const modal = new ModalBuilder()
        .setCustomId(VERIFY_MODAL_ID)
        .setTitle('Enter Your Name');

      const nameInput = new TextInputBuilder()
        .setCustomId(NAME_INPUT_ID)
        .setLabel('What name should we set as your nickname?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. John')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(32); // Discord nickname max length

      const modalRow = new ActionRowBuilder().addComponents(nameInput);
      modal.addComponents(modalRow);

      await interaction.showModal(modal);
      return;
    }

    // 3) Modal submit: change the user's nickname
    if (interaction.isModalSubmit() && interaction.customId === VERIFY_MODAL_ID) {
      const name = interaction.fields.getTextInputValue(NAME_INPUT_ID).trim();

      // Try to change the member's nickname
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: '❌ Could not find you in this server.', ephemeral: true });
        return;
      }

      // Bot permission check
      const botMember = await interaction.guild.members.fetchMe();
      if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        await interaction.reply({ content: '❌ I need the **Manage Nicknames** permission.', ephemeral: true });
        return;
      }

      // Role hierarchy check — can't change nicknames of people above the bot
      if (member.roles.highest.position >= botMember.roles.highest.position) {
        await interaction.reply({
          content: '❌ I can't change your nickname because your role is higher than or equal to mine.',
          ephemeral: true,
        });
        return;
      }

      try {
        await member.setNickname(name, `Verification by ${interaction.user.tag}`);
      } catch (err) {
        console.error('setNickname failed:', err);
        await interaction.reply({ content: '❌ Failed to set nickname. Try again.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `✅ Your nickname has been set to **${name}**!`,
        ephemeral: true,
      });
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    // Safe reply if not already replied
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN);
