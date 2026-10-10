const { Schema, model } = require('mongoose');

const answerSchema = new Schema({ q: String, a: String }, { _id: false });

const supportTicketSchema = new Schema(
  {
    guildId: { type: String, required: true },
    number: { type: Number, required: true },
    userId: { type: String, required: true },
    userTag: { type: String, default: 'unknown' },
    channelId: { type: String, required: true },
    panelId: { type: Number, default: null },
    topicKey: { type: String, default: null },
    topicLabel: { type: String, default: 'Support' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    claimedBy: { type: String, default: null },
    answers: { type: [answerSchema], default: [] },
    controlMessageId: { type: String, default: null },
    addedUsers: { type: [String], default: [] },
    lastActivityAt: { type: Date, default: Date.now },

    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    closeReason: { type: String, default: null },
    rating: { type: Number, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ guildId: 1, number: 1 }, { unique: true });
supportTicketSchema.index({ guildId: 1, channelId: 1 });
supportTicketSchema.index({ guildId: 1, userId: 1, status: 1 });
supportTicketSchema.index({ status: 1, lastActivityAt: 1 });

module.exports = model('SupportTicket', supportTicketSchema);
