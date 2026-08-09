const cron = require('node-cron');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { sendDocumentToAdmin } = require('../utils/telegramBot');

// Haftada bir marta, Yakshanba kuni soat 19:00 da ishlaydi
const scheduleWeeklyBackup = () => {
  // '0 19 * * 0' = Yakshanba 19:00
  cron.schedule('0 19 * * 0', async () => {
    console.log('📦 [Auto-Backup] Haftalik JSON zaxira jarayoni boshlandi...');
    try {
      // 1. Barcha ma'lumotlarni bazadan tortib olish
      const products = await Product.find().lean();
      const customers = await Customer.find().lean();
      const orders = await Order.find().lean();
      const payments = await Payment.find().lean();

      // 2. JSON formatida tayyorlash
      const backupData = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {
          products,
          customers,
          orders,
          payments
        }
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Oboi_Backup_${dateStr}.json`;
      const caption = `🛡 <b>Haftalik Avtomatik Zaxira (JSON)</b>\n📅 Sana: ${dateStr}\n✅ Holati: Muvaffaqiyatli\n📥 Faylni kompyuteringizga saqlab qo'yishingiz mumkin.`;

      // 3. Telegram orqali Adminlarga jo'natish
      const success = await sendDocumentToAdmin(buffer, filename, caption);
      
      if (success) {
        console.log('✅ [Auto-Backup] JSON zaxira Telegramga muvaffaqiyatli yuborildi.');
      } else {
        console.warn('⚠️ [Auto-Backup] Telegramga yuborishda xatolik yuz berdi yoki admin topilmadi.');
      }
    } catch (error) {
      console.error('❌ [Auto-Backup] Zaxira yaratishda xatolik:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Tashkent" // O'zbekiston vaqti bilan
  });
};

module.exports = scheduleWeeklyBackup;
