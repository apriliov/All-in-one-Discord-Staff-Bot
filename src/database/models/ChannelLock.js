const { Schema, model } = require('mongoose');

const entrySchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: Number, required: true },
    existed: { type: Boolean, default: true },
    before: [{ _id: false, perm: String, state: { type: Boolean, default: null } }],
  },
  { _id: false }
);

const channelLockSchema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    lockedBy: { type: String, default: null },
    lockdown: { type: Boolean, default: false },
    entries: { type: [entrySchema], default: [] },
  },
  { timestamps: true }
);

channelLockSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

module.exports = model('ChannelLock', channelLockSchema);
