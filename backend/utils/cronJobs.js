const cron = require('node-cron');
const Shift = require('../models/Shift');
const { logAction } = require('./logger');

const initCronJobs = () => {
  // Har kuni tunda 03:00 da (Asia/Tashkent vaqti) ishga tushadi
  // ✅ FIX: timezone ko'rsatilmagan bo'lsa server UTC da ishlaydi,
  //         bu esa 03:00 UTC = 08:00 Toshkent demak — noto'g'ri!
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🔄 [CRON] Avtomatik smena yopish jarayoni boshlandi...');
      
      // 14 soatdan oshgan ochiq smenalarni topish
      const cutoffTime = new Date(Date.now() - 14 * 60 * 60 * 1000);
      
      const openShifts = await Shift.find({ 
        status: 'open',
        startTime: { $lt: cutoffTime }
      });

      if (openShifts.length > 0) {
        for (const shift of openShifts) {
          shift.status = 'closed';
          shift.endTime = new Date();
          shift.notes = shift.notes 
            ? `${shift.notes} | Avtomatik yopildi (inaktivlik)` 
            : 'Avtomatik yopildi (inaktivlik)';
          
          await shift.save();

          // ✅ FIX: logAction to'g'ri imzosi: (req, action, entity, entityId, details)
          // Cron'da req ob'ekti yo'q — tizim nomidan log yozamiz
          await logAction(
            { user: { _id: null, name: 'Tizim (Cron)' }, ip: 'cron' },
            'SYSTEM',
            'Shift',
            shift._id,
            `Smena avtomatik yopildi (inaktivlik): ${shift._id}, Foydalanuvchi: ${shift.user}`
          );
        }
        console.log(`✅ [CRON] Muvaffaqiyatli ${openShifts.length} ta ochiq smena yopildi.`);
      } else {
        console.log(`✅ [CRON] Yopilishi kerak bo'lgan ochiq smenalar topilmadi.`);
      }
    } catch (error) {
      console.error('❌ [CRON] Avtomatik smena yopishda xatolik:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Tashkent' // ✅ FIX: Aniq timezone — UTC emas, Toshkent vaqti
  });

  console.log("⏳ CRON vazifalar ishga tushirildi (Smena avto-yopish: 03:00 Asia/Tashkent da)");
};

module.exports = { initCronJobs };

