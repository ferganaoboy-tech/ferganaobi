const TelegramSubscriber = require('../models/TelegramSubscriber');
const { getBotInstance } = require('../utils/telegramListener');

// @desc    Get all Telegram subscribers
// @route   GET /api/telegram-subscribers
// @access  Private/SuperAdmin,Admin
exports.getSubscribers = async (req, res) => {
  try {
    const subscribers = await TelegramSubscriber.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: subscribers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve a Telegram subscriber
// @route   PUT /api/telegram-subscribers/:id/approve
// @access  Private/SuperAdmin,Admin
exports.approveSubscriber = async (req, res) => {
  try {
    const sub = await TelegramSubscriber.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, isActive: true },
      { new: true }
    );

    if (!sub) {
      return res.status(404).json({ success: false, message: "Obunachi topilmadi" });
    }

    const bot = getBotInstance();
    if (bot) {
      try {
        bot.sendMessage(
          sub.chatId,
          "🎉 <b>Ajoyib yangilik!</b>\n\nSizning arizangiz admin tomonidan tasdiqlandi. Endi barcha xabarnomalar sizga yetib keladi.",
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        console.error("Bot mesaj yuborishda xatolik:", err.message);
      }
    }

    res.status(200).json({ success: true, data: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject / Revoke a Telegram subscriber
// @route   DELETE /api/telegram-subscribers/:id/reject
// @access  Private/SuperAdmin,Admin
exports.rejectSubscriber = async (req, res) => {
  try {
    const sub = await TelegramSubscriber.findByIdAndDelete(req.params.id);

    if (!sub) {
      return res.status(404).json({ success: false, message: "Obunachi topilmadi" });
    }

    const bot = getBotInstance();
    if (bot) {
      try {
        bot.sendMessage(
          sub.chatId,
          "⛔ <b>Kechirasiz!</b>\n\nSizning arizangiz yoki botdan foydalanish huquqingiz admin tomonidan bekor qilindi.",
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        console.error("Bot mesaj yuborishda xatolik:", err.message);
      }
    }

    res.status(200).json({ success: true, message: "Obunachi o'chirildi" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
