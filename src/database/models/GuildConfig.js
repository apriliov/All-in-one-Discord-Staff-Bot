const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String, default: null },
  helperRoleIds: { type: [String], default: [] },
  adminRoleIds: { type: [String], default: [] },
  caseCounter: { type: Number, default: 0 },

  modmailOpen: { type: Boolean, default: true },
  modmailBlocked: { type: [String], default: [] },
  ticketCounter: { type: Number, default: 0 },
  modmailWelcome: {
    type: new Schema({ title: String, description: String, footer: String, color: String }, { _id: false }),
    default: null,
  },
  modmailCloseMsg: { type: String, default: null },

  giveawayCounter: { type: Number, default: 0 },

  statusText: { type: String, default: null },
});

module.exports = model('GuildConfig', guildConfigSchema);
