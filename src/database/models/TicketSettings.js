const { Schema, model } = require('mongoose');

const ticketSettingsSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  counter: { type: Number, default: 0 },
  panelCounter: { type: Number, default: 0 },

  categoryId: { type: String, default: null },
  logChannelId: { type: String, default: null },
  supportRoleIds: { type: [String], default: [] },
  maxOpen: { type: Number, default: 3 },
  namePattern: { type: String, default: 'ticket-{number}' },

  claim: { type: Boolean, default: true },
  feedback: { type: Boolean, default: true },
  dmTranscript: { type: Boolean, default: true },
  allowUserClose: { type: Boolean, default: true },
  pingSupport: { type: Boolean, default: true },
  autoCloseHours: { type: Number, default: null },
});

module.exports = model('TicketSettings', ticketSettingsSchema);
