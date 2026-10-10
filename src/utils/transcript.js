const esc = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function fetchMessages(channel, max = 2000) {
  const all = [];
  let before;
  while (all.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  return all.reverse();
}

function renderEmbed(embed) {
  const parts = [];
  if (embed.title) parts.push(`<div class="et">${esc(embed.title)}</div>`);
  if (embed.description) parts.push(`<div class="ed">${esc(embed.description).replace(/\n/g, '<br>')}</div>`);
  for (const f of embed.fields || []) {
    parts.push(`<div class="ef"><b>${esc(f.name)}</b><br>${esc(f.value).replace(/\n/g, '<br>')}</div>`);
  }
  if (embed.image && embed.image.url) parts.push(`<img class="ei" src="${esc(embed.image.url)}">`);
  const color = embed.color !== null && embed.color !== undefined ? `#${embed.color.toString(16).padStart(6, '0')}` : '#4f545c';
  return `<div class="embed" style="border-left-color:${color}">${parts.join('')}</div>`;
}

function renderMessage(m) {
  const author = m.author;
  const avatar = author.displayAvatarURL ? author.displayAvatarURL({ size: 64 }) : '';
  const content = m.cleanContent || m.content || '';
  const body = [];
  if (content) body.push(`<div class="content">${esc(content).replace(/\n/g, '<br>')}</div>`);
  for (const e of m.embeds) body.push(renderEmbed(e));
  for (const a of m.attachments.values()) {
    if (a.contentType && a.contentType.startsWith('image/')) body.push(`<a href="${esc(a.url)}"><img class="att" src="${esc(a.url)}"></a>`);
    else body.push(`<div class="file"><a href="${esc(a.url)}">${esc(a.name || 'file')}</a></div>`);
  }
  if (!body.length) return '';
  return (
    `<div class="msg"><img class="av" src="${esc(avatar)}"><div class="main">` +
    `<div class="head"><span class="name">${esc(author.username)}</span>${author.bot ? '<span class="bot">BOT</span>' : ''}` +
    `<span class="time">${esc(m.createdAt.toISOString().replace('T', ' ').slice(0, 19))} UTC</span></div>${body.join('')}</div></div>`
  );
}

function buildHtmlTranscript({ guildName, ticket, messages, closedBy, reason }) {
  const number = String(ticket.number).padStart(4, '0');
  const meta = [
    `User: ${esc(ticket.userTag)} (${esc(ticket.userId)})`,
    `Topic: ${esc(ticket.topicLabel)}`,
    ticket.claimedBy ? `Claimed by: ${esc(ticket.claimedBy)}` : null,
    closedBy ? `Closed by: ${esc(closedBy.username)}` : null,
    reason ? `Reason: ${esc(reason)}` : null,
    `Messages: ${messages.length}`,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #${number} transcript</title>
<style>
body{margin:0;background:#313338;color:#dbdee1;font-family:"gg sans",Whitney,Helvetica,Arial,sans-serif;font-size:15px}
header{padding:20px 24px;background:#2b2d31;border-bottom:1px solid #1e1f22}
header h1{margin:0 0 6px;font-size:20px;color:#fff}
header div{color:#b5bac1;font-size:13px;margin-top:2px}
.wrap{padding:16px 24px;max-width:960px}
.msg{display:flex;gap:14px;margin:14px 0}
.av{width:40px;height:40px;border-radius:50%;flex:none;background:#1e1f22}
.main{min-width:0}
.name{font-weight:600;color:#fff;margin-right:8px}
.bot{background:#5865f2;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-right:8px}
.time{font-size:12px;color:#949ba4}
.content{white-space:normal;word-wrap:break-word;overflow-wrap:anywhere}
.embed{margin-top:4px;background:#2b2d31;border-left:4px solid #4f545c;border-radius:4px;padding:8px 12px;max-width:520px}
.et{font-weight:700;color:#fff;margin-bottom:4px}
.ef{margin-top:6px;font-size:14px}
.ei,.att{max-width:360px;max-height:300px;border-radius:6px;margin-top:6px;display:block}
a{color:#00a8fc}
</style></head><body>
<header><h1>${esc(guildName)} - Ticket #${number}</h1>${meta.map((m) => `<div>${m}</div>`).join('')}</header>
<div class="wrap">${messages.map(renderMessage).join('')}</div>
</body></html>`;
}

module.exports = { fetchMessages, buildHtmlTranscript, esc };
