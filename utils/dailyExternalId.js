const DailyCounter = require('../models/DailyCounter');

async function generateDailyExternalId(now = new Date()) {
  const key = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  for (;;) {
    try {
      const counter = await DailyCounter.findOneAndUpdate(
        { key },
        { $inc: { sequence: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return `${key.slice(0, 4)}-${String(counter.sequence).padStart(3, '0')}`;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}

module.exports = { generateDailyExternalId };
