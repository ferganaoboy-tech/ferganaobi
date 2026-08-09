const EventEmitter = require('events');
const telegramBot = require('../utils/telegramBot');
const { logAction } = require('../utils/logger'); // if needed later

class OrderEventEmitter extends EventEmitter {}
const orderEvents = new OrderEventEmitter();

// Buyurtma muvaffaqiyatli yaratilganda
orderEvents.on('orderCreated', async ({ order, io, syncDeltas }) => {
  try {
    const { clearDashboardCache } = require('../controllers/orderController');
    clearDashboardCache();

    // 1. Emit to WebSockets
    if (io) {
      const whId = order.warehouse._id || order.warehouse;
      io.to(whId.toString()).emit('order:created', { order, syncDeltas });
    }
    // 2. Send Telegram Receipt (Text version - fast)
    await telegramBot.sendOrderReceipt(order);
  } catch (error) {
    console.error('Event Error (orderCreated):', error);
  }
});

// Sklad kamayganda
orderEvents.on('stockLow', async ({ productDoc, io }) => {
  try {
    // 1. Emit to WebSockets
    if (io) {
      const whId = productDoc.warehouse._id || productDoc.warehouse;
      io.to(whId.toString()).emit('stock:low', { 
        product: { brand: productDoc.brand, artikul: productDoc.artikul }, 
        quantity: productDoc.quantity, 
        minStock: productDoc.minStock, 
        warehouse: { name: productDoc.warehouse?.name } 
      });
    }
    // 2. Send Telegram Warning
    await telegramBot.sendLowStockWarning(productDoc);
  } catch (error) {
    console.error('Event Error (stockLow):', error);
  }
});

module.exports = orderEvents;
