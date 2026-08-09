const PushSubscription = require('../models/PushSubscription');
const webpush = require('web-push');

// Fallback kalitlar (Muhim: Agar .env da kalitlar yozilmagan bo'lsa bular ishlatiladi)
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BN85UPCcuQDb0asnDftiuhNoh-NoeM8j3-4pImhzKpgYNzhIXQ3ODlfWYw3jkcysMYFBx6MkqrHmLouxfXU9b84';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'VRqWsoatNJ3MCFuHNwtetjSwiRqOtOJnucBc66A-VTA';

webpush.setVapidDetails(
  'mailto:support@oboicrm.uz',
  publicVapidKey,
  privateVapidKey
);

exports.getPublicKey = (req, res) => {
  res.status(200).json({ publicKey: publicVapidKey });
};

exports.subscribe = async (req, res) => {
  try {
    const subscription = req.body;
    
    // Eski obunani tekshirish
    const existing = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    
    if (existing) {
      existing.user = req.user._id;
      existing.warehouse = req.user.warehouse || null;
      await existing.save();
    } else {
      await PushSubscription.create({
        user: req.user._id,
        warehouse: req.user.warehouse || null,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceInfo: req.headers['user-agent'] || 'Unknown'
      });
    }

    res.status(201).json({ success: true, message: "Web Push obunasi muvaffaqiyatli saqlandi." });
  } catch (error) {
    console.error("Push obunasida xatolik:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.status(200).json({ success: true, message: "Web Push obunasi bekor qilindi." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ─── HELPER: KUTILAYOTGAN OMORGA PUSH YUBORISH ────────────────────────────
 *
 * @param {string} warehouseId - Qabul qiluvchi ombor ID si
 * @param {Object} payload - { title, body, icon, url }
 */
exports.sendPushToWarehouse = async (warehouseId, payload) => {
  try {
    // Ombor ishchilari va superadminlarni topish
    const subscriptions = await PushSubscription.find({
      $or: [
        { warehouse: warehouseId },
        { warehouse: null } // Odatda superadminlarda warehouse null bo'lishi mumkin
      ]
    }).populate('user', 'role');

    // Faqat tegishli userlar (superadmin yoki shu ombor ishchilari)
    const validSubs = subscriptions.filter(sub => 
      sub.user?.role === 'superadmin' || 
      (sub.warehouse && sub.warehouse.toString() === warehouseId.toString())
    );

    const pushPayload = JSON.stringify(payload);

    let sent = 0;
    for (const sub of validSubs) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, pushPayload);
        sent++;
      } catch (err) {
        // Agar xato bo'lsa (masalan endpoint eskirgan bo'lsa), uni o'chirib tashlaymiz
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.warn("Push xatosi:", err.message);
        }
      }
    }
    console.log(`[Web Push] ${sent}/${validSubs.length} kishiga xabar bordi.`);
  } catch (error) {
    console.error("Web push yuborishda xatolik:", error);
  }
};
