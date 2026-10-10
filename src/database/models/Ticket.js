const { Schema, model } = require('mongoose');

const ticketSchema = new Schema(
  {
    guildId: { type: String, required: true },
    ticketId: { type: Number, required: true },
    userId: { type: String, required: true },
    userTag: { type: String, default: 'unknown' },
    channelId: { type: String, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    openedBy: { type: String, default: null },
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    closeReason: { type: String, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ guildId: 1, ticketId: 1 }, { unique: true });
ticketSchema.index({ guildId: 1, channelId: 1 });

ticketSchema.index({ guildId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });

module.exports = model('Ticket', ticketSchema);
