const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { logAction } = require('../utils/logger');

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res) => {
  try {
    const { customer, order, method, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const query = {};

    if (customer) query.customer = typeof customer === 'string' ? customer : undefined;
    if (order) query.order = typeof order === 'string' ? order : undefined;
    if (method && method !== 'Barchasi') query.method = typeof method === 'string' ? method : undefined;

    // ✅ FIX: Warehouse asosida filtrlash — filial xodimi faqat o'z to'lovlarini ko'radi
    // Ilgari bu filtr yo'q edi — har qanday kassir barcha filial to'lovlarini ko'rardi
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      query.warehouse = req.user.warehouse;
    } else if (req.query.warehouse) {
      query.warehouse = typeof req.query.warehouse === 'string' ? req.query.warehouse : undefined;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
      }
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await Payment.countDocuments(query);

    const payments = await Payment.find(query)
      .populate('customer', 'name phone')
      .populate('order', 'orderNumber debtAmount')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Create payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let populatedPayment;
    let paymentAmountFinal;
    let customerDoc;
    let orderNumberFinal = 'Umumiy qarz';

    await session.withTransaction(async () => {
      const { order: orderId, customer: customerId, amount, method, notes, receivedBy } = req.body;
      const paymentAmount = Number(amount);
      paymentAmountFinal = paymentAmount;

      if (!paymentAmount || paymentAmount <= 0) {
        throw new Error("To'lov summasi musbat bo'lishi kerak");
      }

      const customer = await Customer.findById(customerId).session(session);
      if (!customer || !customer.isActive) {
        throw new Error("Mijoz topilmadi");
      }
      customerDoc = customer;

      if (orderId) {
        // 1. Specific order payment
        const order = await Order.findOne({ _id: orderId, customer: customerId }).session(session);
        if (!order) {
          throw new Error('Buyurtma topilmadi yoki bu mijozga tegishli emas');
        }

        if (paymentAmount > order.debtAmount) {
          throw new Error(`To'lov summasi buyurtma qarzdorligidan oshib ketdi. Buyurtma qarzi: ${order.debtAmount} so'm`);
        }

        order.paidAmount += paymentAmount;
        await order.save({ session }); // pre-save hook updates debtAmount

        // Create the payment
        const paymentArray = await Payment.create([{
          order: orderId,
          customer: customerId,
          amount: paymentAmount,
          method,
          notes,
          receivedBy:   req.user ? req.user.name : (receivedBy || 'Tizim'),
          receivedById: req.user ? req.user._id  : undefined,
        }], { session });
        const payment = paymentArray[0];

        // Update customer totalDebt using $inc
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { totalDebt: -paymentAmount }
        }, { session });

        populatedPayment = await Payment.findById(payment._id)
          .populate('customer', 'name phone')
          .populate('order', 'orderNumber')
          .session(session);

        orderNumberFinal = order.orderNumber;
      } else {
        // 2. General customer payment (Umumiy qarzdan uzish)
        if (paymentAmount > customer.totalDebt) {
          throw new Error(`To'lov summasi jami qarzdorlikdan oshib ketdi. Jami qarz: ${customer.totalDebt} so'm`);
        }

        const debtOrders = await Order.find({
          customer: customerId,
          status: { $in: ['confirmed', 'delivered'] },
          debtAmount: { $gt: 0 }
        }).sort({ createdAt: 1 }).session(session);

        let remainingToDistribute = paymentAmount;
        const updatedOrders = [];
        
        const bulkOperations = [];
        
        for (let o of debtOrders) {
          if (remainingToDistribute <= 0) break;

          const applyToThisOrder = Math.min(remainingToDistribute, o.debtAmount);

          // ✅ FIX: $inc bilan paidAmount oshiramiz va debtAmount atomik formula bilan hisoblaymiz.
          // $set { debtAmount } o'rniga DB'da hisoblash — overrideTotalAmount bo'lsa ham to'g'ri ishlaydi.
          bulkOperations.push({
            updateOne: {
              filter: { _id: o._id },
              update: {
                $inc: { 
                  paidAmount: applyToThisOrder,
                  debtAmount: -applyToThisOrder
                }
              }
            }
          });

          remainingToDistribute -= applyToThisOrder;
          updatedOrders.push({ orderNumber: o.orderNumber, applied: applyToThisOrder });
        }

        if (bulkOperations.length > 0) {
          await Order.bulkWrite(bulkOperations, { session });
        }

        // Create the payment record
        const paymentArray = await Payment.create([{
          customer: customerId,
          amount: paymentAmount,
          method,
          notes: notes || (updatedOrders.length > 0
            ? `Umumiy qarzdan uzish (Yopilgan buyurtmalar: ${updatedOrders.map(x => `${x.orderNumber} (${x.applied} so'm)`).join(', ')})`
            : 'Umumiy qarzdan uzish'),
          receivedBy:   req.user ? req.user.name : (receivedBy || 'Tizim'),
          receivedById: req.user ? req.user._id  : undefined,
        }], { session });
        const payment = paymentArray[0];

        // Update customer totalDebt using $inc to prevent race condition over totalDebt
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { totalDebt: -paymentAmount }
        }, { session });

        populatedPayment = await Payment.findById(payment._id)
          .populate('customer', 'name phone')
          .session(session);
      }
    });

    // Cleanup: ensure totalDebt never goes negative as a failsafe (though $inc logic prevents divergence)
    await Customer.updateOne(
      { _id: customerDoc._id, totalDebt: { $lt: 0 } },
      { $set: { totalDebt: 0 } }
    );

    // Outside transaction - Emits and external side effects
    // ✅ FIX: To'lov qabul qilinganda dashboard cache ham tozalanadi
    // Oldin payment'dan keyin 10 daqiqa eski statistika ko'rinar edi
    const { clearDashboardCache } = require('../controllers/orderController');
    clearDashboardCache();

    const syncDeltas = {
      products: [],
      customer: {
        id: customerDoc._id.toString(),
        debtDelta: -paymentAmountFinal,
        purchasedDelta: 0
      }
    };

    const whId = populatedPayment.warehouse ? populatedPayment.warehouse._id || populatedPayment.warehouse : (req.user?.warehouse?._id || req.user?.warehouse);
    if (whId) {
      req.app.get('io').to(whId.toString()).emit('payment:received', {
        customer: { name: customerDoc.name, phone: customerDoc.phone },
        amount: paymentAmountFinal,
        orderNumber: orderNumberFinal,
        payment: populatedPayment,
        syncDeltas
      });
    } else {
      req.app.get('io').emit('payment:received', {
        customer: { name: customerDoc.name, phone: customerDoc.phone },
        amount: paymentAmountFinal,
        orderNumber: orderNumberFinal,
        payment: populatedPayment,
        syncDeltas
      });
    }

    const telegramBot = require('../utils/telegramBot');
    telegramBot.sendPaymentReceipt(populatedPayment).catch(err =>
      console.error("Telegram to'lov yuborish xatosi:", err)
    );

    await logAction(
      req, 'PAYMENT', 'Payment', populatedPayment._id,
      `To'lov qabul qilindi: ${paymentAmountFinal} so'm (${customerDoc.name})`
    );

    return res.status(201).json({ success: true, data: populatedPayment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// @desc    Get customer payments
// @route   GET /api/payments/customer/:customerId
// @access  Public
exports.getCustomerPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.params.customerId })
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
