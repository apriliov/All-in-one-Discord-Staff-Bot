const { Schema, model } = require('mongoose');

const giveawaySchema = new Schema(
  {
    guildId: { type: String, required: true },
    giveawayId: { type: Number, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    hostId: { type: String, required: true },

    prize: { type: String, required: true },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    color: { type: String, default: null },

    winnerCount: { type: Number, default: 1 },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'paused', 'ended'], default: 'active' },
    remainingMs: { type: Number, default: null },
    endedAt: { type: Date, default: null },

    requiredRoleId: { type: String, default: null },
    bonusRoleId: { type: String, default: null },
    bonusEntries: { type: Number, default: 1 },

    entrants: { type: [String], default: [] },
    bonusUsers: { type: [String], default: [] },
    winners: { type: [String], default: [] },
  },
  { timestamps: true }
);

giveawaySchema.index({ guildId: 1, giveawayId: 1 }, { unique: true });
giveawaySchema.index({ status: 1, endsAt: 1 });
giveawaySchema.index({ guildId: 1, messageId: 1 });

module.exports = model('Giveaway', giveawaySchema);
