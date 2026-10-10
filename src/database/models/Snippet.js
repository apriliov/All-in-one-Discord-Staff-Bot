const { Schema, model } = require('mongoose');

const snippetSchema = new Schema(
  {
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

snippetSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = model('Snippet', snippetSchema);
