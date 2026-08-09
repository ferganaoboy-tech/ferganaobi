const mongoose = require('mongoose');
const Shift = require('../models/Shift');
const Payment = require('../models/Payment');
const Return = require('../models/Return');
const { logAction } = require('../utils/logger');

// ─── Joriy ochiq smenani olish ────────────────────────────────────────────────
exports.getCurrentShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({ user: req.user._id, status: 'open' });
    res.status(200).json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Smenani boshlash ─────────────────────────────────────────────────────────
exports.startShift = async (req, res) => {
  try {
    const { startingCash } = req.body;

    const existingShift = await Shift.findOne({ user: req.user._id, status: 'open' });
    if (existingShift) {
      return res.status(400).json({
        success: false,
        message: 'Sizda allaqachon ochiq smena mavjud'
      });
    }

    const shift = await Shift.create({
      user: req.user._id,
      startingCash: startingCash || 0,
      startTime: new Date()
    });

    await logAction(req, 'START_SHIFT', 'Shift', shift._id,
      `Smena ochildi. Kassa: ${startingCash || 0}`
    );

    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Smenani yopish ───────────────────────────────────────────────────────────
/**
 * closeShift
 *
 * ✅ FIX: receivedById (ObjectId) bilan query — ism o'zgarganda ham aniq.
 *         Fallback: eski receivedBy (String) ham tekshiriladi (backward compat).
 *         Vozvrat hisoblashda ham aniq query (processedBy string → user._id based).
 */
exports.closeShift = async (req, res) => {
  try {
    const { actualCash, notes } = req.body;

    const shift = await Shift.findOne({ user: req.user._id, status: 'open' });
    if (!shift) {
      return res.status(400).json({ success: false, message: 'Ochiq smena topilmadi' });
    }

    // ✅ FIX: receivedById bilan primary query, String bilan fallback
    const paymentQuery = {
      createdAt: { $gte: shift.startTime },
      method: 'naqd',
      $or: [
        { receivedById: req.user._id },                    // ← Yangi: ObjectId
        { receivedBy: req.user.name }                      // ← Eski: String fallback
      ]
    };

    const payments = await Payment.find(paymentQuery).lean();
    const cashSales = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Return larni ham aniqlash
    const returnQuery = {
      createdAt: { $gte: shift.startTime },
      $or: [
        { processedById: req.user._id },                   // ← Yangi: ObjectId (agar kerak bo'lsa)
        { processedBy: req.user.name }                     // ← Mavjud: String
      ]
    };

    const returns = await Return.find(returnQuery).lean();
    const cashReturns = returns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);

    const expectedCash = shift.startingCash + cashSales - cashReturns;
    const difference   = (actualCash || 0) - expectedCash;

    shift.endTime      = new Date();
    shift.cashSales    = cashSales;
    shift.cashReturns  = cashReturns;
    shift.expectedCash = expectedCash;
    shift.actualCash   = actualCash || 0;
    shift.difference   = difference;
    shift.notes        = notes;
    shift.status       = 'closed';

    await shift.save();

    await logAction(req, 'CLOSE_SHIFT', 'Shift', shift._id,
      `Smena yopildi. Kutilgan: ${expectedCash}, Haqiqiy: ${actualCash || 0}, Farq: ${difference}`
    );

    res.status(200).json({ success: true, data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Auto-close: 24 soatdan ortiq ochiq smenalarni yopish ────────────────────
/**
 * autoCloseStaleShifts — cron job tomonidan chaqiriladi.
 *
 * 24 soatdan ortiq ochiq qolgan smenalarni avtomatik yopadi.
 * Kassir browser yopib ketsa — smena cheksiz ochiq qolmaydi.
 */
exports.autoCloseStaleShifts = async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 soat oldin
    const staleShifts = await Shift.find({
      status: 'open',
      startTime: { $lt: cutoff }
    });

    if (staleShifts.length === 0) return;

    for (const shift of staleShifts) {
      // To'lovlarni hisoblash (smena davomidagi)
      const payments = await Payment.find({
        createdAt: { $gte: shift.startTime },
        method: 'naqd',
        $or: [
          { receivedById: shift.user },
          // String-based fallback uchun user populate kerak bo'ladi
          // Soddalik uchun faqat ObjectId ishlatamiz
        ]
      }).lean();
      const cashSales = payments.reduce((s, p) => s + (p.amount || 0), 0);

      const returns = await Return.find({
        createdAt: { $gte: shift.startTime },
        processedById: shift.user
      }).lean();
      const cashReturns = returns.reduce((s, r) => s + (r.totalRefundAmount || 0), 0);

      const expectedCash = shift.startingCash + cashSales - cashReturns;

      await Shift.findByIdAndUpdate(shift._id, {
        status: 'closed',
        endTime: new Date(),
        cashSales,
        cashReturns,
        expectedCash,
        actualCash: 0,           // Kassir yopmaganligi uchun 0
        difference: -expectedCash,
        notes: 'AVTOMATIK YOPILDI — Kassir smenani yopmagan (24 soat)'
      });

      console.log(`⏰ Smena avtomatik yopildi: user=${shift.user}, startTime=${shift.startTime}`);
    }

    console.log(`✅ ${staleShifts.length} ta eskirgan smena avtomatik yopildi.`);
  } catch (error) {
    console.error('Auto-close smena xatosi:', error.message);
  }
};
