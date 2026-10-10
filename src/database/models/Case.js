const { Schema, model } = require('mongoose');

const caseSchema = new Schema(
  {
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: ['warn', 'note', 'timeout', 'untimeout', 'kick', 'softban', 'ban', 'unban'],
    },
    userId: { type: String, required: true },
    userTag: { type: String, default: 'unknown' },
    moderatorId: { type: String, required: true },
    moderatorTag: { type: String, default: 'unknown' },
    reason: { type: String, default: 'No reason provided' },
    duration: { type: Number, default: null },
  },
  { timestamps: true }
);

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1, type: 1 });

module.exports = model('Case', caseSchema);
