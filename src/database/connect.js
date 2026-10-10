const mongoose = require('mongoose');

async function fixLegacyTicketIndexes() {
  const Ticket = require('./models/Ticket');
  try {
    const indexes = await Ticket.collection.indexes().catch(() => []);
    const legacy = indexes.find((i) => i.name === 'guildId_1');
    if (legacy) {
      await Ticket.collection.dropIndex('guildId_1');
      console.log('[DB] Dropped the legacy unique index "guildId_1" on the tickets collection.');
    }
    await Ticket.init();
  } catch (err) {
    console.warn('[DB] Could not fix the ticket indexes:', err.message);
  }
}

async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGO_URI is missing. Add your own MongoDB connection string to the .env file.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('[DB] Connected to MongoDB.');
  await fixLegacyTicketIndexes();
}

module.exports = { connectDatabase };
