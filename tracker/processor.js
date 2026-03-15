const logger = require('./logger');
const { sendEmail } = require('./email');

function processItem(item, results, state) {
  // find lowest price found
  let currentPrice = null;
  results.forEach(r => {
    if (r.price) {
      const m = r.price.replace(/[^0-9\.]/g, '');
      const p = parseFloat(m);
      if (!isNaN(p) && (currentPrice === null || p < currentPrice)) {
        currentPrice = p;
      }
    }
  });
  const stateEntry = state[item.name] || {};
  if (currentPrice !== null) {
    if (!stateEntry.lastPrice || currentPrice < stateEntry.lastPrice) {
      // price drop or new
      logger.info('Price drop detected', { item: item.name, old: stateEntry.lastPrice, new: currentPrice });
      if (process.env.NOTIFY_EMAIL) {
        sendEmail(process.env.NOTIFY_EMAIL,
          `Price alert: ${item.name}`,
          `${item.name} price dropped from ${stateEntry.lastPrice || 'N/A'} to ${currentPrice}.`);
      }
    }
    state[item.name] = { lastPrice: currentPrice, lastChecked: new Date().toISOString() };
  }
}

module.exports = { processItem };
