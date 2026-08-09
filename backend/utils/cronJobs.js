const cron = require('node-cron');
const Shift = require('../models/Shift');
const { logAction } = require('./logger');

const initCronJobs = () => {
  // Har kuni tunda 03:00 da ishga tushadi
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

          await logAction({
            action: 'Avtomatik smena yopildi',
            performedBy: shift.user,
            details: `Smena ID: ${shift._id}`,
          });
        }
        console.log(`✅ [CRON] Muvaffaqiyatli ${openShifts.length} ta ochiq smena yopildi.`);
      } else {
        console.log(`✅ [CRON] Yopilishi kerak bo'lgan ochiq smenalar topilmadi.`);
      }
    } catch (error) {
      console.error('❌ [CRON] Avtomatik smena yopishda xatolik:', error);
    }
  });

  console.log('⏳ CRON vazifalar ishga tushirildi (Smena avto-yopish: 03:00 da)');
};

module.exports = { initCronJobs };
