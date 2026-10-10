const { Schema, model } = require('mongoose');

const questionSchema = new Schema(
  {
    label: { type: String, required: true },
    long: { type: Boolean, default: false },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const topicSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    emoji: { type: String, default: null },
    style: { type: String, enum: ['blurple', 'grey', 'green', 'red'], default: 'blurple' },
    description: { type: String, default: null },
    categoryId: { type: String, default: null },
    supportRoleIds: { type: [String], default: [] },
    welcome: { type: String, default: null },
    namePattern: { type: String, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false }
);

const panelSchema = new Schema(
  {
    guildId: { type: String, required: true },
    panelId: { type: Number, required: true },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    title: { type: String, default: 'Support Tickets' },
    description: { type: String, default: 'Select a topic below to open a ticket.' },
    color: { type: String, default: null },
    image: { type: String, default: null },
    footer: { type: String, default: null },
    style: { type: String, enum: ['button', 'menu'], default: 'button' },
    topics: { type: [topicSchema], default: [] },
  },
  { timestamps: true }
);

panelSchema.index({ guildId: 1, panelId: 1 }, { unique: true });

module.exports = model('TicketPanel', panelSchema);
