const cron = require('node-cron');
const { generateAndSendDailyReport } = require('../controllers/reportController');
const { autoCloseStaleShifts } = require('../controllers/shiftController');

const initDailyReportJob = () => {
  // ─── Kunlik hisobot: har kuni 19:00 da (Asia/Tashkent) ──────────────────
  cron.schedule('0 19 * * *', async () => {
    console.log('📊 Avtomatik kunlik hisobot yuborilmoqda...');
    const date = new Date();
    const todayStr = date.toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    // Atomic lock check: only one instance will succeed in updating this
    const Settings = require('../models/Settings');
    const settings = await Settings.findOneAndUpdate(
      { 
        $or: [
          { lastDailyReportDate: { $ne: todayStr } },
          { lastDailyReportDate: { $exists: false } }
        ]
      },
      { $set: { lastDailyReportDate: todayStr } },
      { new: true }
    );

    if (settings) {
      await generateAndSendDailyReport(date);
      console.log(`✅ [CRON-LOCK] Kunlik hisobot yuborildi (Sana: ${todayStr}). Boshqa instancelar bloklandi.`);
    } else {
      console.log(`⏳ [CRON-LOCK] Hisobot allaqachon boshqa instance tomonidan yuborilgan (Sana: ${todayStr}). O'tkazib yuborildi.`);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Tashkent'
  });

  // ─── Eskirgan smenalarni avtomatik yopish: har kuni 00:05 da ────────────
  // Kassir browser yopib ketsa va smenasini yopmasa —
  // keyingi kuni 00:05 da avtomatik yopiladi.
  cron.schedule('5 0 * * *', async () => {
    console.log('⏰ Eskirgan (24h+) smenalar tekshirilmoqda...');
    await autoCloseStaleShifts();
  }, {
    scheduled: true,
    timezone: 'Asia/Tashkent'
  });

  console.log("✅ Cron joblar o'rnatildi:");
  console.log("   📊 Kunlik hisobot    → 19:00 Asia/Tashkent");
  console.log("   ⏰ Auto-close smena  → 00:05 Asia/Tashkent");
};

module.exports = initDailyReportJob;
