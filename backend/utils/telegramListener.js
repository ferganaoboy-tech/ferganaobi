const TelegramBot = require('node-telegram-bot-api');
const TelegramSubscriber = require('../models/TelegramSubscriber');

// ─── Singleton pattern — bir nechta polling sessiyasining oldini olish ──────
let botInstance = null;
let isInitializing = false;

/**
 * initTelegramListener
 *
 * Xavfsizlik modeli:
 *  - /start → obunachi PENDING holatda yaratiladi (isApproved: false)
 *  - Admin chat_id dan /approve <chatId> → obunachini tasdiqlash
 *  - Admin chat_id dan /revoke <chatId>  → obunachini o'chirish
 *  - /stop → o'zini obunadan chiqarish
 *  - /pending → admin uchun: tasdiqlashni kutayotganlar ro'yxati
 *
 *  Bu mexanizm istalgan begona kishi kompaniyaning moliyaviy
 *  ma'lumotlarini olishini oldini oladi.
 */
const initTelegramListener = async (io) => {
  if (botInstance) {
    console.log('Telegram bot listener allaqachon ishlamoqda.');
    return botInstance;
  }

  if (isInitializing) {
    console.log("Telegram bot initialize bo'lmoqda, kutilmoqda...");
    return null;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN mavjud emas. Bot listener ishga tushmadi.');
    return null;
  }

  // Admin chat ID — .env da sozlanishi kerak
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  isInitializing = true;

  try {
    const webhookUrl = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || 'https://ferganaobi.onrender.com';
    const useWebhook = process.env.NODE_ENV === 'production';

    const bot = new TelegramBot(token, {
      polling: !useWebhook ? {
        interval: 1000,
        autoStart: true,
        params: { timeout: 10 }
      } : false
    });

    botInstance = bot;

    if (useWebhook) {
      console.log(`Telegram Webhook o'rnatilmoqda: ${webhookUrl}/api/telegram-webhook`);
      bot.setWebHook(`${webhookUrl}/api/telegram-webhook`)
        .then(() => console.log('✅ Webhook muvaffaqiyatli o\'rnatildi!'))
        .catch(err => console.error('❌ Webhook o\'rnatishda xatolik:', err));
    } else {
      console.log('Telegram Polling rejimida ishga tushdi.');
      // ─── Polling xatolarini boshqarish ────────────────────────────────────
      bot.on('polling_error', (err) => {
        const errMsg = err.message || '';
        if (errMsg.includes('409') || errMsg.includes('Conflict')) {
          console.error("Telegram 409 Conflict: Boshqa polling sessiyasi mavjud. 10 soniyadan so'ng qayta uriniladi...");
          bot.stopPolling().catch(() => {});
          botInstance = null;
          isInitializing = false;
          setTimeout(() => initTelegramListener(), 10000);
        } else if (errMsg.includes('EFATAL')) {
          console.error('Telegram EFATAL xatosi:', errMsg);
          botInstance = null;
          isInitializing = false;
        } else {
          console.warn('Telegram polling xatosi:', errMsg);
        }
      });
    }

    // ─── /start — Obunachi ro'yxatdan o'tish (PENDING → admin tasdiqlaydi) ─
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const firstName = msg.chat.first_name || '';
      const username = msg.chat.username || '';

      try {
        let subscriber = await TelegramSubscriber.findOne({ chatId });

        if (!subscriber) {
          // Yangi obunachi — tasdiqlash kutilmoqda
          subscriber = new TelegramSubscriber({
            chatId,
            firstName,
            username,
            isActive: true,
            isApproved: false  // ← PENDING: admin tasdiqlashi kerak
          });
          await subscriber.save();

          bot.sendMessage(chatId,
            `Assalomu alaykum, <b>${firstName}</b>! ✅\n\n` +
            `Sizning arizangiz yuborildi.\n` +
            `⏳ <b>Admin tasdiqlagunga qadar</b> bildirishnomalar kelmaydi.\n\n` +
            `Tasdiqlangach, sizga xabar beriladi.`,
            { parse_mode: 'HTML' }
          );

          if (io) {
            io.emit('telegram-subscribers-updated');
          }

          // Adminga xabar
          if (ADMIN_CHAT_ID) {
            bot.sendMessage(ADMIN_CHAT_ID,
              `🔔 <b>Yangi obunachi talabi:</b>\n\n` +
              `👤 Ism: <b>${firstName}</b>\n` +
              `🔑 Username: @${username || 'yo\'q'}\n` +
              `🆔 Chat ID: <code>${chatId}</code>\n\n` +
              `✅ Tasdiqlash: /approve ${chatId}\n` +
              `❌ Rad etish: /revoke ${chatId}`,
              { parse_mode: 'HTML' }
            );
          }
        } else {
          if (!subscriber.isActive) {
            subscriber.isActive = true;
            await subscriber.save();
            bot.sendMessage(chatId, 'Qaytganingiz bilan! ✅');
          } else if (!subscriber.isApproved) {
            bot.sendMessage(chatId,
              '⏳ Sizning arizangiz hali ko\'rib chiqilmoqda. Kuting.',
              { parse_mode: 'HTML' }
            );
          } else {
            bot.sendMessage(chatId, 'Siz allaqachon botga a\'zo bo\'lgansiz. ✅');
          }
        }
      } catch (error) {
        console.error("Telegram ro'yxatdan o'tishda xatolik:", error);
        bot.sendMessage(chatId, "Kechirasiz, xatolik yuz berdi. Qaytadan urinib ko'ring.");
      }
    });

    // ─── /stop — O'zini obunadan chiqarish ───────────────────────────────────
    bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id.toString();
      try {
        await TelegramSubscriber.findOneAndUpdate({ chatId }, { isActive: false });
        bot.sendMessage(chatId,
          "❌ Siz xabarnomalarni o'chirib qo'ydingiz.\nQayta yoqish uchun /start ni bosing."
        );
      } catch (error) {
        console.error('Telegram /stop xatosi:', error);
      }
    });

    // ─── /approve <chatId> — Admin: obunachini tasdiqlash ───────────────────
    bot.onText(/\/approve (.+)/, async (msg, match) => {
      const senderChatId = msg.chat.id.toString();

      // Faqat admin bajara oladi
      if (senderChatId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(senderChatId, "⛔ Bu buyruq faqat admin uchun.");
      }

      const targetChatId = match[1].trim();
      try {
        const sub = await TelegramSubscriber.findOneAndUpdate(
          { chatId: targetChatId },
          { isApproved: true, isActive: true },
          { new: true }
        );
        if (!sub) {
          return bot.sendMessage(senderChatId, `❌ ${targetChatId} chatId topilmadi.`);
        }
        bot.sendMessage(senderChatId, `✅ ${targetChatId} (${sub.firstName}) tasdiqlandi!`);
        // Obunachiga xabar
        bot.sendMessage(targetChatId,
          '🎉 Siz tasdiqlandi! Endi barcha bildirishnomalar sizga keladi.',
          { parse_mode: 'HTML' }
        );

        if (io) {
          io.emit('telegram-subscribers-updated');
        }
      } catch (err) {
        console.error('Telegram /approve xatosi:', err);
        bot.sendMessage(senderChatId, `❌ Xatolik: ${err.message}`);
      }
    });

    // ─── /revoke <chatId> — Admin: obunachini o'chirish ─────────────────────
    bot.onText(/\/revoke (.+)/, async (msg, match) => {
      const senderChatId = msg.chat.id.toString();

      if (senderChatId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(senderChatId, "⛔ Bu buyruq faqat admin uchun.");
      }

      const targetChatId = match[1].trim();
      try {
        const sub = await TelegramSubscriber.findOneAndUpdate(
          { chatId: targetChatId },
          { isApproved: false, isActive: false },
          { new: true }
        );
        if (!sub) {
          return bot.sendMessage(senderChatId, `❌ ${targetChatId} chatId topilmadi.`);
        }
        bot.sendMessage(senderChatId, `🚫 ${targetChatId} (${sub.firstName}) o'chirildi.`);
        bot.sendMessage(targetChatId,
          "⛔ Sizning obunangiz admin tomonidan bekor qilindi.",
          { parse_mode: 'HTML' }
        );

        if (io) {
          io.emit('telegram-subscribers-updated');
        }
      } catch (err) {
        console.error('Telegram /revoke xatosi:', err);
        bot.sendMessage(senderChatId, `❌ Xatolik: ${err.message}`);
      }
    });

    // ─── /pending — Admin: tasdiqlashni kutayotganlar ro'yxati ──────────────
    bot.onText(/\/pending/, async (msg) => {
      const senderChatId = msg.chat.id.toString();

      if (senderChatId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(senderChatId, "⛔ Bu buyruq faqat admin uchun.");
      }

      try {
        const pending = await TelegramSubscriber.find({ isApproved: false, isActive: true });
        if (pending.length === 0) {
          return bot.sendMessage(senderChatId, '✅ Tasdiqlashni kutayotgan obunachi yo\'q.');
        }
        let text = `⏳ <b>Tasdiqlashni kutayotganlar (${pending.length} ta):</b>\n\n`;
        pending.forEach((p, i) => {
          text += `${i + 1}. <b>${p.firstName || 'Nomsiz'}</b> (@${p.username || 'yo\'q'})\n`;
          text += `   🆔 <code>${p.chatId}</code>\n`;
          text += `   ✅ /approve ${p.chatId}\n\n`;
        });
        bot.sendMessage(senderChatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Telegram /pending xatosi:', err);
        bot.sendMessage(senderChatId, `❌ Xatolik: ${err.message}`);
      }
    });

    // ─── /subscribers — Admin: barcha aktiv obunachillar ────────────────────
    bot.onText(/\/subscribers/, async (msg) => {
      const senderChatId = msg.chat.id.toString();

      if (senderChatId !== ADMIN_CHAT_ID) {
        return bot.sendMessage(senderChatId, "⛔ Bu buyruq faqat admin uchun.");
      }

      try {
        const subs = await TelegramSubscriber.find({ isApproved: true, isActive: true });
        if (subs.length === 0) {
          return bot.sendMessage(senderChatId, 'Aktiv obunachi yo\'q.');
        }
        let text = `✅ <b>Aktiv obunachillar (${subs.length} ta):</b>\n\n`;
        subs.forEach((s, i) => {
          text += `${i + 1}. <b>${s.firstName || 'Nomsiz'}</b> — <code>${s.chatId}</code>\n`;
        });
        bot.sendMessage(senderChatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Telegram /subscribers xatosi:', err);
      }
    });

    // ─── Graceful shutdown ────────────────────────────────────────────────────
    const stopBot = async () => {
      if (botInstance) {
        console.log("Telegram bot polling to'xtatilmoqda...");
        try {
          await bot.stopPolling();
        } catch (_) { /* Davom etamiz */ }
        botInstance = null;
        isInitializing = false;
      }
    };

    process.once('SIGTERM', stopBot);
    process.once('SIGINT', stopBot);

    console.log('✅ Telegram bot listener muvaffaqiyatli ishga tushdi!');
    console.log(`   Admin Chat ID: ${ADMIN_CHAT_ID || 'O\'RNATILMAGAN — .env da TELEGRAM_ADMIN_CHAT_ID qo\'shing!'}`);
    isInitializing = false;
    return bot;
  } catch (err) {
    console.error('Telegram bot ishga tushirishda xatolik:', err.message);
    botInstance = null;
    isInitializing = false;
    return null;
  }
};

const getBotInstance = () => botInstance;

module.exports = { initTelegramListener, getBotInstance };
