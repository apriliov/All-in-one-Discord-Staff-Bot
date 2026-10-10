const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../../utils/embeds');
const { findSupportTicket } = require('../../services/tickets');

module.exports = {
  name: 'closerequest',
  aliases: ['crq'],
  description: 'Ask the ticket owner if the ticket can be closed. They answer with a button.',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'message', type: 'string', description: 'Optional note for the user', maxLength: 300 }],
  async run(ctx, args) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tk:crq:yes').setLabel('Close ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tk:crq:no').setLabel('Keep open').setEmoji('✋').setStyle(ButtonStyle.Secondary)
    );
    return ctx.reply({
      content: `<@${ticket.userId}>`,
      embeds: [embeds.info(`A staff member asks if this ticket can be closed. If your issue is solved, press **Close ticket**.${args.message ? `\n\n**Note:** ${args.message}` : ''}`)],
      components: [row],
      allowedMentions: { users: [ticket.userId] },
    });
  },
};
