const { Events, MessageFlags } = require('discord.js');
const config = require('../config');
const { Context } = require('../core/context');
const { dispatch } = require('../core/dispatch');
const { getGuildConfig } = require('../services/guildConfig');
const { getLevel, LEVELS } = require('../core/permissions');
const embeds = require('../utils/embeds');
const { CLOSE_BUTTON_ID, findTicketByChannel, closeTicket, getStaffLevel } = require('../services/modmail');
const tickets = require('../services/tickets');
const giveaways = require('../services/giveaways');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleButton(client, interaction) {
  if (interaction.customId !== CLOSE_BUTTON_ID) return;
  const refuse = (text) => interaction.reply({ embeds: [embeds.error(text)], flags: MessageFlags.Ephemeral }).catch(() => {});

  if (!interaction.inGuild() || !config.isAllowedGuild(interaction.guildId)) return refuse('This button only works in the staff server.');
  if ((await getStaffLevel(interaction.guild, interaction.user.id)) < LEVELS.helper) return refuse('Only staff can close tickets.');

  const ticket = await findTicketByChannel(interaction.guildId, interaction.channelId);
  if (!ticket) return refuse('This ticket is already closed.');

  const row = interaction.message.components[0];
  const disabled = row ? [{ type: 1, components: row.components.map((c) => ({ ...c.toJSON(), disabled: true })) }] : [];
  await interaction.update({ components: disabled });
  await interaction.followUp({ embeds: [embeds.info('🔒 Closing this ticket in 5 seconds. The transcript will be sent to your DMs.')] });
  await sleep(5000);
  await closeTicket(client, interaction.guild, ticket, { closedBy: interaction.user });
}

async function handleAutocomplete(client, interaction) {
  const respond = (choices = []) => interaction.respond(choices).catch(() => {});
  const command = client.registry.commands.get(interaction.commandName);
  if (!command || typeof command.autocomplete !== 'function' || !interaction.inGuild()) return respond();
  if (!config.isAllowedGuild(interaction.guildId)) return respond();
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const level = config.ownerIds.has(member.id) ? LEVELS.owner : getLevel(member, await getGuildConfig(interaction.guildId));
    if (level < LEVELS[command.level]) return respond();
    await command.autocomplete(interaction);
  } catch (err) {
    console.warn('[AUTOCOMPLETE]', err.message);
    respond();
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) return handleAutocomplete(client, interaction);
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      const id = interaction.customId || '';
      const fail = (name) => (err) => {
        console.error(`[${name}] Interaction failed:`, err);
        const payload = { embeds: [embeds.error('Something went wrong. Please try again.')], flags: MessageFlags.Ephemeral };
        const send = interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
        return send.catch(() => {});
      };
      if (id.startsWith('tk:')) return tickets.handleInteraction(client, interaction).catch(fail('TICKETS'));
      if (id.startsWith('gw:')) return giveaways.handleInteraction(client, interaction).catch(fail('GIVEAWAY'));
      if (interaction.isButton() && id === CLOSE_BUTTON_ID) return handleButton(client, interaction).catch((err) => console.error('[MODMAIL] Button failed:', err));
      return;
    }
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.inGuild() || !config.isAllowedGuild(interaction.guildId)) {
      return interaction
        .reply({ content: 'This bot only works inside the staff server.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }

    const command = client.registry.commands.get(interaction.commandName);
    if (!command) return;

    await dispatch(new Context(client, { interaction }), command);
  },
};
