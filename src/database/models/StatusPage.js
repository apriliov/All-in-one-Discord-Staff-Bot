const { Schema, model } = require('mongoose');

const statusPageSchema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
  },
  { timestamps: true }
);

statusPageSchema.index({ guildId: 1, channelId: 1 }, { unique: true });
statusPageSchema.index({ messageId: 1 });

module.exports = model('StatusPage', statusPageSchema);
