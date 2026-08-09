const TelegramSubscriber = require('../models/TelegramSubscriber');
const Warehouse = require('../models/Warehouse');

/**
 * Helper: Exponential backoff bilan xabar yuborish
 */
const sendWithRetry = async (url, payload, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, payload);
      if (response.ok) return true;
      console.warn(`Telegram API Xato (Urinish ${i + 1}):`, response.statusText);
    } catch (error) {
      console.warn(`Telegram tarmoq xatosi (Urinish ${i + 1}):`, error.message);
    }
    await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
  }
  throw new Error("Telegram xabar jo'natish amalga oshmadi.");
};

/**
 * ─── TELEGRAM RATE LIMIT QUEUE (SENIOR LEVEL) ──────────────────────────────
 * Telegram API qat'iy limitlarga ega (global: 30 xabar/sekund). 
 * Bitta operatsiyada birdaniga 50 ta guruhga xabar ketsa 429 xatosi chiqmasligi uchun
 * In-Memory Async Queue orqali xabarlarni bittalab (navbat bilan) jo'natamiz.
 */
class TelegramQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    // 50ms kutish = sekundiga max 20 ta xabar jo'natish imkonini beradi. Limitdan xavfsiz o'tadi.
    this.processIntervalMs = 50; 
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      await task();
      // Har bir xabardan keyin Rate Limit'ga tushmaslik uchun tanaffus ushlaymiz
      await new Promise(res => setTimeout(res, this.processIntervalMs));
    }

    this.isProcessing = false;
  }
}

const telegramQueue = new TelegramQueue();

/**
 * Bitta chat_id ga matn xabar yuborish (Queued)
 */
const sendMessageToChat = async (token, chatId, message) => {
  return telegramQueue.enqueue(async () => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await sendWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
  });
};

/**
 * Bitta chat_id ga rasm yuborish (Queued)
 */
const sendPhotoToChat = async (token, chatId, buffer, caption) => {
  return telegramQueue.enqueue(async () => {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([buffer], { type: 'image/png' }), 'receipt.png');
    if (caption) formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) {
      console.warn(`Telegram rasm yuborishda xatolik (${chatId}):`, response.statusText);
    }
  });
};

/**
 * ─── MARKAZIY DISPATCH VA MAQSADLI GURUHLARNI ANIQLASH ───────────────────────
 *
 * Mantiq (Senior Level):
 * Barcha warehouse lar o'z guruhlariga ega bo'lishi mumkin (telegramChatId).
 * Agar foydalanuvchi /start orqali qo'shilgan guruh aslida biron skladga tegishli bo'lsa,
 * u faqat o'sha sklad ma'lumotlarini olishi kerak, u umumiy "global" emas.
 * Shu sababli, qaysi chatId Skladga biriktirilgan bo'lsa, uni umumiy ro'yxatdan chetlatamiz
 * va FAQAT o'zining skladiga tegishli xabarni yuboramiz.
 */

const resolveTargetChatIds = async (targetWarehouseIds = [], isFinancial = false) => {
  const chatIds = new Set();

  // Barcha filial guruhlarini aniqlaymiz
  const allWarehouses = await Warehouse.find({ telegramChatId: { $exists: true, $ne: '' } }).select('telegramChatId').lean();
  const warehouseChatIds = new Set(allWarehouses.map(w => w.telegramChatId));

  // 1. Agar xabar maxsus filial(lar) uchun bo'lsa, ularning guruhlarini qo'shamiz
  for (const whId of targetWarehouseIds) {
    if (whId) {
      const warehouse = await Warehouse.findById(whId).select('telegramChatId name').lean();
      if (warehouse?.telegramChatId) {
        chatIds.add(warehouse.telegramChatId);
        console.log(`📦 [Telegram] Sklad kanaliga yuborilmoqda: ${warehouse.name} (${warehouse.telegramChatId})`);
      }
    }
  }

  // 2. Global obunachilar (faqat filiallarga bog'lanmagan guruhlar/shaxslar global hisoblanadi)
  const subscribers = await TelegramSubscriber.find({ isActive: true, isApproved: true }).lean();
  subscribers.forEach(sub => {
    // Agar bu chatId biror filialning guruhi bo'lsa, u global obunachi hisoblanmaydi
    if (warehouseChatIds.has(sub.chatId)) {
      return;
    }
    chatIds.add(sub.chatId);
  });

  // 3. .env dagi umumiy va moliya guruhlari (agar filial guruhi sifatida o'rnatilmagan bo'lsa)
  const globalChat = process.env.TELEGRAM_CHAT_ID;
  if (globalChat && !isFinancial && !warehouseChatIds.has(globalChat)) {
    chatIds.add(globalChat);
  }

  const financeChat = process.env.TELEGRAM_FINANCE_CHAT_ID;
  if (isFinancial && financeChat && !warehouseChatIds.has(financeChat)) {
    chatIds.add(financeChat);
  }

  return chatIds;
};

/**
 * Xabarni mos maqsadlarga yuboradi
 */
const dispatchMessage = async (token, message, warehouseId = null, isFinancial = false) => {
  try {
    const targetWarehouseIds = warehouseId ? [warehouseId] : [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, isFinancial);

    if (chatIds.size === 0) {
      console.log('[Telegram] Hech qanday maqsad topilmadi. Xabar yuborilmadi.');
      return false;
    }

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendMessageToChat(token, chatId, message);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] ID: ${chatId} ga xabar yuborilmadi:`, err.message);
      }
    }

    console.log(`[Telegram] ${successCount}/${chatIds.size} ta chat ga xabar yetkazildi.`);
    return successCount > 0;
  } catch (error) {
    console.error('[Telegram] Dispatch xatosi:', error);
    return false;
  }
};

/**
 * ─── Rasm uchun MARKAZIY DISPATCH ────────────────────────────────────────────
 */
const dispatchPhoto = async (token, buffer, caption, warehouseId = null) => {
  try {
    const targetWarehouseIds = warehouseId ? [warehouseId] : [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, false);

    if (chatIds.size === 0) return false;

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendPhotoToChat(token, chatId, buffer, caption);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] Rasm ID: ${chatId} ga yuborilmadi:`, err.message);
      }
    }
    return successCount > 0;
  } catch (error) {
    console.error('[Telegram] Rasm dispatch xatosi:', error);
    return false;
  }
};

// ─── Eski broadcastToSubscribers — global xabarlar uchun saqlanadi ────────────
// (paymentReceipt, dailyReport kabi faqat global bo'lishi kerak bo'lgan xabarlar)
const broadcastGlobal = async (token, message, isFinancial = true) => {
  return dispatchMessage(token, message, null, isFinancial);
};


/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EKSPORT QILINADIGAN FUNKSIYALAR
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Buyurtma chekini yuborish — Sklad kanaliga + Global obunachilarga
 * @param {Object} order — Populate qilingan Order hujjati
 */
exports.sendOrderReceipt = async (order) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const warehouseId = order.warehouse?._id || order.warehouse;
    const orderId = order.orderNumber || (order._id ? order._id.toString().slice(-6).toUpperCase() : '');

    let itemsText = '';
    if (order.items && order.items.length > 0) {
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const artikul = item.product?.artikul || 'Yo\'q';
        const brand = item.product?.brand ? item.product.brand + ' - ' : '';
        const polka = item.product?.polka || 'Kiritilmagan';
        const unit = item.unit || 'dona';
        
        const categoryName = item.product?.category ? `[${item.product.category.toUpperCase()}] ` : '';
        // Ultra-professional yig'uv formati (Tree-structured)
        const chunk = `\n📦 <b>${categoryName}${brand}${artikul}</b>  ➜  <b>${item.quantity} ${unit}</b>\n└ 📍 <i>Polka: ${polka}</i>\n`;
        
        if (itemsText.length + chunk.length > 900) {
           itemsText += `\n<i>... va yana ${order.items.length - i} ta mahsulot.</i>`;
           break;
        }
        itemsText += chunk;
      }
    }

    const sellerName = order.seller?.name || "Asosiy";
    const message = `🚨 <b>DIQQAT BUYURTMA #${orderId} ‼️</b>\n━━━━━━━━━━━━━━━━━━\n👨‍💼 <b>Sotuvchi:</b> ${sellerName}\n━━━━━━━━━━━━━━━━━━${itemsText}\n━━━━━━━━━━━━━━━━━━\n🏃‍♂️ <i>Mijoz kutib qoldi, iltimos tezroq olib keling !</i> ⏱`;

    return await dispatchMessage(token, message, warehouseId);
  } catch (error) {
    console.error('Telegramga buyurtma yuborishda xatolik:', error.message);
    return false;
  }
};

/**
 * Vozvrat chekini yuborish — Sklad kanaliga + Global obunachilarga
 */
exports.sendReturnReceipt = async (returnDoc) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const warehouseId = returnDoc.warehouse?._id || returnDoc.warehouse;
    const customerName = returnDoc.customer?.name || "Noma'lum mijoz";
    const orderNumber = returnDoc.order?.orderNumber || '';

    let itemsText = '';
    returnDoc.items.forEach((item, index) => {
      const productName = item.product?.brand || 'Mahsulot';
      const artikul = item.product?.artikul || '';
      const unit = item.unit || 'dona';
      const total = item.refundAmount ? item.refundAmount.toLocaleString('ru-RU') : '0';
      itemsText += `${index + 1}. 🔄 <b>${productName}</b> (${artikul})\n`;
      itemsText += `      📦 ${item.quantity} ${unit} qaytdi (Summa: ${total} so'm)\n`;
    });

    const formatMoney = (amount) => amount ? amount.toLocaleString('ru-RU') + " so'm" : "0 so'm";

    // Vozvratlar Telegramga yuborilmasligi uchun olib tashlandi, faqat web sahifada aks etadi
    return true;
  } catch (error) {
    console.error('Telegramga vozvrat yuborishda xatolik:', error.message);
    return false;
  }
};

/**
 * Tezkor vozvrat — Sklad kanaliga + Global obunachilarga
 */
exports.sendQuickReturnReceipt = async (returnDoc) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const warehouseId = returnDoc.warehouse?._id || returnDoc.warehouse;

    let itemsText = '';
    returnDoc.items.forEach((item, index) => {
      const productName = item.product?.brand || item.product?.artikul || "Noma'lum mahsulot";
      const artikul = item.product?.artikul || '';
      const unit = item.unit || 'dona';
      const total = item.refundAmount ? item.refundAmount.toLocaleString('ru-RU') : '0';
      itemsText += `${index + 1}. 🔄 <b>${productName}</b> (${artikul})\n`;
      itemsText += `      📦 ${item.quantity} ${unit} qabul qilindi (Summa: ${total} so'm)\n`;
    });

    const formatMoney = (amount) => amount ? amount.toLocaleString('ru-RU') + " so'm" : "0 so'm";

    // Vozvratlar Telegramga yuborilmasligi uchun olib tashlandi, faqat web sahifada aks etadi
    return true;
  } catch (error) {
    console.error('Telegramga tezkor vozvrat yuborishda xatolik:', error.message);
    return false;
  }
};

/**
 * Transfer (o'tkazma) — IKKala sklad kanaliga + Global obunachilarga
 * fromWarehouse va toWarehouse kanallari alohida bildirishnoma oladi.
 */
exports.sendTransferReceipt = async (transfer) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const fromWarehouseId = transfer.fromWarehouse?._id || transfer.fromWarehouse;
    const toWarehouseId = transfer.toWarehouse?._id || transfer.toWarehouse;
    const fromWarehouse = transfer.fromWarehouse?.name || "Noma'lum";
    const toWarehouse = transfer.toWarehouse?.name || "Noma'lum";
    const sentBy = transfer.sentBy
      ? `${transfer.sentBy.firstName || ''} ${transfer.sentBy.lastName || transfer.sentBy.name || ''}`.trim()
      : "Noma'lum";

    let itemsText = '';
    transfer.items.forEach((item, index) => {
      const productName = item.product?.brand || 'Mahsulot';
      const artikul = item.product?.artikul || '';
      const categoryName = item.product?.category ? `[${item.product.category.toUpperCase()}] ` : '';
      itemsText += `${index + 1}. 📦 <b>${categoryName}${productName}</b> (${artikul})\n`;
      itemsText += `      Miqdor: ${item.quantity} ${item.unit || 'rulon'}\n`;
    });

    const statusIcon = transfer.status === 'completed' ? '✅' : '⏳';
    const statusText = transfer.status === 'completed' ? 'QABUL QILINDI' : 'YUBORILDI';

    const message = `
${statusIcon} <b>YANGI O'TKAZMA: #${transfer.transferNumber} — ${statusText}</b>

📤 <b>Kimdan (Sklad):</b> ${fromWarehouse}
📥 <b>Kimga (Sklad):</b> ${toWarehouse}
👨‍💻 <b>Yubordi:</b> ${sentBy}
💬 <b>Izoh:</b> ${transfer.notes || "Yo'q"}

📋 <b>O'TKAZILAYOTGAN MAHSULOTLAR:</b>
${itemsText}
📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    // O'tkazmalar faqat global/umumiy botga tushishi uchun ombor guruhlariga bormaydi
    const targetWarehouseIds = [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, false);

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendMessageToChat(token, chatId, message);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] Transfer: ${chatId} ga yuborilmadi:`, err.message);
      }
    }
    return successCount > 0;
  } catch (error) {
    console.error("Telegramga o'tkazma yuborishda xatolik:", error.message);
    return false;
  }
};

/**
 * Boshqa filialdan mahsulot so'rash (Transfer Request) bildirishnomasi
 * Asosan so'ralayotgan filialga (Kosmos) yuboriladi.
 */
exports.sendTransferRequestNotification = async (transfer) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    // fromWarehouse = Kosmos (qayerdan so'ralyapti)
    // toWarehouse = Chust (kim so'rayapti)
    const fromWarehouseId = transfer.fromWarehouse?._id || transfer.fromWarehouse;
    const toWarehouseId = transfer.toWarehouse?._id || transfer.toWarehouse;
    const fromWarehouse = transfer.fromWarehouse?.name || "Noma'lum";
    const toWarehouse = transfer.toWarehouse?.name || "Noma'lum";
    const requestedBy = transfer.sentBy
      ? `${transfer.sentBy.firstName || ''} ${transfer.sentBy.lastName || transfer.sentBy.name || ''}`.trim()
      : "Noma'lum";

    let itemsText = '';
    transfer.items.forEach((item, index) => {
      const productName = item.product?.brand || 'Mahsulot';
      const artikul = item.product?.artikul || '';
      const categoryName = item.product?.category ? `[${item.product.category.toUpperCase()}] ` : '';
      itemsText += `${index + 1}. 📦 <b>${categoryName}${productName}</b> (${artikul})\n`;
      itemsText += `      So'ralgan miqdor: ${item.quantity} ${item.unit || 'rulon'}\n`;
    });

    const message = `
🔔 <b>YANGI MAHSULOT SO'ROVI: #${transfer.transferNumber}</b>

📥 <b>So'rovchi (Kimga kerak):</b> ${toWarehouse}
📤 <b>Qayerdan so'ralyapti:</b> ${fromWarehouse}
👨‍💻 <b>So'rovchi xodim:</b> ${requestedBy}
💬 <b>Izoh:</b> ${transfer.notes || "Yo'q"}

📋 <b>SO'RALAYOTGAN MAHSULOTLAR:</b>
${itemsText}

⚠️ <i>Iltimos, tizimga kirib so'rovni tasdiqlang yoki rad eting.</i>
📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    // O'tkazmalar faqat global/umumiy botga tushishi uchun ombor guruhlariga bormaydi
    const targetWarehouseIds = [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, false);

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendMessageToChat(token, chatId, message);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] Transfer Request: ${chatId} ga yuborilmadi:`, err.message);
      }
    }
    return successCount > 0;
  } catch (error) {
    console.error("Telegramga transfer so'rovini yuborishda xatolik:", error.message);
    return false;
  }
};

/**
 * Boshqa filialdan mahsulot so'rash (Transfer Request) RAD ETILGANDA bildirishnoma
 * So'rovchi filialga (Chust) yuboriladi.
 */
exports.sendTransferRequestRejectedNotification = async (transfer) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const fromWarehouseId = transfer.fromWarehouse?._id || transfer.fromWarehouse;
    const toWarehouseId = transfer.toWarehouse?._id || transfer.toWarehouse;
    const fromWarehouse = transfer.fromWarehouse?.name || "Noma'lum";
    const toWarehouse = transfer.toWarehouse?.name || "Noma'lum";
    const rejectedBy = transfer.receivedBy
      ? `${transfer.receivedBy.firstName || ''} ${transfer.receivedBy.lastName || transfer.receivedBy.name || ''}`.trim()
      : "Noma'lum";

    let itemsText = '';
    transfer.items.forEach((item, index) => {
      const productName = item.product?.brand || 'Mahsulot';
      const artikul = item.product?.artikul || '';
      itemsText += `${index + 1}. 📦 <b>${productName}</b> (${artikul}) - ${item.quantity} ta\n`;
    });

    const message = `
❌ <b>MAHSULOT SO'ROVI RAD ETILDI: #${transfer.transferNumber}</b>

📥 <b>Sizning filialingiz:</b> ${toWarehouse}
📤 <b>Rad etgan filial:</b> ${fromWarehouse}
👨‍💻 <b>Rad etgan xodim:</b> ${rejectedBy}

📋 <b>SO'RALGAN MAHSULOTLAR:</b>
${itemsText}

⚠️ <i>So'ragan mahsulotingiz ushbu filial tomonidan rad etildi.</i>
📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    // O'tkazmalar faqat global/umumiy botga tushishi uchun ombor guruhlariga bormaydi
    const targetWarehouseIds = [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, false);

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendMessageToChat(token, chatId, message);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] Transfer Reject: ${chatId} ga yuborilmadi:`, err.message);
      }
    }
    return successCount > 0;
  } catch (error) {
    console.error("Telegramga reject so'rovini yuborishda xatolik:", error.message);
    return false;
  }
};

/**
 * Boshqa filialdan mahsulot so'rash (Transfer Request) TASDIQLANGANDA bildirishnoma
 * So'rovchi filialga (Chust) yuboriladi.
 */
exports.sendTransferRequestApprovedNotification = async (transfer) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const fromWarehouseId = transfer.fromWarehouse?._id || transfer.fromWarehouse;
    const toWarehouseId = transfer.toWarehouse?._id || transfer.toWarehouse;
    const fromWarehouse = transfer.fromWarehouse?.name || "Noma'lum";
    const toWarehouse = transfer.toWarehouse?.name || "Noma'lum";
    const approvedBy = transfer.receivedBy
      ? `${transfer.receivedBy.firstName || ''} ${transfer.receivedBy.lastName || transfer.receivedBy.name || ''}`.trim()
      : "Noma'lum";

    let itemsText = '';
    transfer.items.forEach((item, index) => {
      const productName = item.product?.brand || 'Mahsulot';
      const artikul = item.product?.artikul || '';
      itemsText += `${index + 1}. 📦 <b>${productName}</b> (${artikul}) - ${item.quantity} ta\n`;
    });

    const message = `
✅ <b>MAHSULOT SO'ROVI TASDIQLANDI: #${transfer.transferNumber}</b>

📥 <b>Sizning filialingiz:</b> ${toWarehouse}
📤 <b>Tasdiqlagan filial:</b> ${fromWarehouse}
👨‍💻 <b>Tasdiqlagan xodim:</b> ${approvedBy}

📋 <b>YUBORILAYOTGAN MAHSULOTLAR:</b>
${itemsText}

🚚 <i>Mahsulotlar filialingiz hisobiga o'tkazildi!</i>
📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    // O'tkazmalar faqat global/umumiy botga tushishi uchun ombor guruhlariga bormaydi
    const targetWarehouseIds = [];
    const chatIds = await resolveTargetChatIds(targetWarehouseIds, false);

    let successCount = 0;
    for (const chatId of chatIds) {
      try {
        await sendMessageToChat(token, chatId, message);
        successCount++;
      } catch (err) {
        console.warn(`[Telegram] Transfer Approve: ${chatId} ga yuborilmadi:`, err.message);
      }
    }
    return successCount > 0;
  } catch (error) {
    console.error("Telegramga approve so'rovini yuborishda xatolik:", error.message);
    return false;
  }
};

/**
 * To'lov qabul qilindi — FAQAT Global obunachilarga (moliyaviy ma'lumot)
 * Sklad kanaliga yuborilmaydi — xavfsizlik uchun.
 */
exports.sendPaymentReceipt = async (payment) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const customerName = payment.customer?.name || "Noma'lum mijoz";
    const formatMoney = (amount) => amount ? amount.toLocaleString('ru-RU') + " so'm" : "0 so'm";
    const method = payment.method === 'naqd' ? '💵 Naqd' : '💳 Karta';
    const orderText = payment.order
      ? `🧾 <b>Buyurtma uchun:</b> ${payment.order.orderNumber}`
      : '📌 <b>Umumiy qarz uchun</b>';

    const message = `
💸 <b>TO'LOV QABUL QILINDI</b>

👤 <b>Mijoz:</b> ${customerName}
${orderText}
💰 <b>Summa:</b> ${formatMoney(payment.amount)}
🏦 <b>To'lov usuli:</b> ${method}
💬 <b>Izoh:</b> ${payment.notes || "Yo'q"}
👨‍💻 <b>Qabul qildi:</b> ${payment.receivedBy || 'Tizim'}

📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    // Moliyaviy xabar — faqat global (sklad kanaliga bormaydi)
    return await broadcastGlobal(token, message);
  } catch (error) {
    console.error("Telegramga to'lov yuborishda xatolik:", error.message);
    return false;
  }
};

/**
 * Kam qolgan tovar ogohlantirishsi — Sklad kanaliga + Global obunachilarga
 */
exports.sendLowStockWarning = async (product) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const warehouseId = product.warehouse?._id || product.warehouse;

    const message = `
🚨 <b>DIQQAT! SKLADDA TOVAR TUGAMOQDA!</b>

🛍 <b>Mahsulot:</b> ${product.brand || product.artikul}
🔢 <b>Artikul:</b> ${product.artikul}
📉 <b>Qolgan miqdor:</b> ${product.quantity} ${product.unit || 'rulon'}
⚠️ <b>Minimal miqdor:</b> ${product.minStock} ${product.unit || 'rulon'}
🏭 <b>Sklad:</b> ${product.warehouse?.name || 'Asosiy'}

<i>Iltimos, zaxirani to'ldiring!</i>
    `.trim();

    return await broadcastGlobal(token, message, false);
  } catch (error) {
    console.error('Telegramga ogohlantirish yuborishda xatolik:', error.message);
    return false;
  }
};

/**
 * Kunlik hisobot — Telegramga yuborilmaydi (Faqat web orqali ko'riladi)
 */
exports.sendDailyReport = async (stats) => {
  // Kunlik hisobot telegram guruhlariga yuborilishi bekor qilingan
  return true;
};

/**
 * Filial uchun maxsus kunlik hisobot — Telegramga yuborilmaydi
 */
exports.sendBranchDailyReport = async (stats, warehouseId, warehouseName) => {
  // Kunlik hisobot telegram guruhlariga yuborilishi bekor qilingan
  return true;
};

/**
 * Chek rasmini yuborish — Sklad kanaliga + Global obunachilarga
 */
exports.sendReceiptPhoto = async (order, base64Image) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    const warehouseId = order.warehouse?._id || order.warehouse;
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const orderId = order.orderNumber || (order._id ? order._id.toString().slice(-6).toUpperCase() : '');
    
    let itemsText = '';
    if (order.items && order.items.length > 0) {
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const artikul = item.product?.artikul || 'Yo\'q';
        const brand = item.product?.brand ? item.product.brand + ' - ' : '';
        const polka = item.product?.polka || 'Kiritilmagan';
        const unit = item.unit || 'dona';
        
        const categoryName = item.product?.category ? `[${item.product.category.toUpperCase()}] ` : '';
        // Ultra-professional yig'uv formati (Tree-structured)
        const chunk = `\n📦 <b>${categoryName}${brand}${artikul}</b>  ➜  <b>${item.quantity} ${unit}</b>\n└ 📍 <i>Polka: ${polka}</i>\n`;
        
        if (itemsText.length + chunk.length > 900) {
           itemsText += `\n<i>... va yana ${order.items.length - i} ta mahsulot.</i>`;
           break;
        }
        itemsText += chunk;
      }
    }

    const sellerName = order.seller?.name || "Asosiy";
    const caption = `🚨 <b>DIQQAT BUYURTMA #${orderId} ‼️</b>\n━━━━━━━━━━━━━━━━━━\n👨‍💼 <b>Sotuvchi:</b> ${sellerName}\n━━━━━━━━━━━━━━━━━━${itemsText}\n━━━━━━━━━━━━━━━━━━\n🏃‍♂️ <i>Mijoz kutib qoldi, iltimos tezroq olib keling !</i> ⏱`;

    return await dispatchPhoto(token, buffer, caption, warehouseId);
  } catch (error) {
    console.error('Telegramga chek rasmini yuborishda xatolik:', error.message);
    return false;
  }
};

/**
 * ─── Hujjat (Document) jo'natish faqat Adminga ──────────────────────────────
 */
exports.sendDocumentToAdmin = async (buffer, filename, caption) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    // Faqat xususiy botga ulangan (guruh bo'lmagan) adminlarga (yoki global chatga) yuboramiz.
    const chatIds = new Set();
    const subscribers = await TelegramSubscriber.find({ isActive: true, isApproved: true }).lean();
    subscribers.forEach(sub => {
      // Guruhlar odatda manfiy ID ga ega. Faqat admin (shaxsiy) bo'lsa
      if (sub.chatId && !sub.chatId.startsWith('-')) {
        chatIds.add(sub.chatId);
      }
    });

    const globalChat = process.env.TELEGRAM_CHAT_ID;
    if (globalChat && chatIds.size === 0) {
      chatIds.add(globalChat);
    }

    if (chatIds.size === 0) return false;

    let successCount = 0;
    for (const chatId of chatIds) {
      await telegramQueue.enqueue(async () => {
        const url = `https://api.telegram.org/bot${token}/sendDocument`;
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', new Blob([buffer], { type: 'application/json' }), filename);
        if (caption) formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        
        const response = await fetch(url, { method: 'POST', body: formData });
        if (response.ok) {
          successCount++;
        } else {
          console.warn(`Telegram hujjat yuborishda xato (${chatId}):`, response.statusText);
        }
      });
    }

    return successCount > 0;
  } catch (error) {
    console.error('[Telegram] Hujjat yuborish xatosi:', error);
    return false;
  }
};
