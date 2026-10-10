const { MessageFlags } = require('discord.js');
const { getGuildConfig } = require('../services/guildConfig');
const { getLevel, LEVELS } = require('./permissions');
const config = require('../config');

const swap = (text) => (typeof text === 'string' ? text.split('{prefix}').join(config.prefix) : text);

function applyPrefix(data) {
  if (data.content) data.content = swap(data.content);
  for (const embed of data.embeds || []) {
    const d = embed && embed.data ? embed.data : embed;
    if (!d) continue;
    d.title = swap(d.title);
    d.description = swap(d.description);
    if (d.footer) d.footer.text = swap(d.footer.text);
    if (d.author) d.author.name = swap(d.author.name);
    for (const f of d.fields || []) {
      f.name = swap(f.name);
      f.value = swap(f.value);
    }
  }
  return data;
}

const normalize = (payload) => applyPrefix(typeof payload === 'string' ? { content: payload } : { ...payload });

class Context {
  constructor(client, { interaction = null, message = null }) {
    this.client = client;
    this.interaction = interaction;
    this.message = message;
    const source = interaction || message;
    this.guild = source.guild;
    this.channel = source.channel;
    this.user = interaction ? interaction.user : message.author;
    this.member = source.member;
    this.ephemeral = false;
    this.level = LEVELS.none;
    this.config = null;
  }

  get isSlash() {
    return !!this.interaction;
  }

  async init() {
    if (!this.member || !this.member.roles || !this.member.roles.cache) {
      this.member = await this.guild.members.fetch(this.user.id).catch(() => null);
    }
    this.config = await getGuildConfig(this.guild.id);
    if (this.member) this.level = getLevel(this.member, this.config);
    else this.level = config.ownerIds.has(this.user.id) ? LEVELS.owner : LEVELS.none;
  }

  async reply(payload) {
    const data = normalize(payload);
    if (!data.allowedMentions) data.allowedMentions = { parse: [] };

    if (this.interaction) {
      const i = this.interaction;
      if (i.deferred && !i.replied) return i.editReply(data);
      if (this.ephemeral) data.flags = MessageFlags.Ephemeral;
      return i.replied ? i.followUp(data) : i.reply(data);
    }
    return this.message.reply(data);
  }

  async send(payload) {
    const data = normalize(payload);
    if (!data.allowedMentions) data.allowedMentions = { parse: [] };
    return this.channel.send(data);
  }
}

module.exports = { Context };
