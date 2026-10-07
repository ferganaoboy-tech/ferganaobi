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
      const { order: singleOrderId, orders: orderIdsArray, customer: customerId, amount, method, notes, receivedBy } = req.body;
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

      // Normalize to array of orders if possible
      let targetOrderIds = [];
      if (orderIdsArray && Array.isArray(orderIdsArray) && orderIdsArray.length > 0) {
        targetOrderIds = orderIdsArray;
      } else if (singleOrderId) {
        targetOrderIds = [singleOrderId];
      }

      if (targetOrderIds.length > 0) {
        // 1. Specific orders payment
        const debtOrders = await Order.find({ 
          _id: { $in: targetOrderIds }, 
          customer: customerId 
        }).sort({ createdAt: 1 }).session(session);

        if (debtOrders.length === 0) {
          throw new Error('Buyurtmalar topilmadi yoki bu mijozga tegishli emas');
        }

        const totalSelectedDebt = debtOrders.reduce((sum, o) => sum + o.debtAmount, 0);

        if (paymentAmount > totalSelectedDebt) {
          throw new Error(`To'lov summasi tanlangan buyurtmalar qarzdorligidan oshib ketdi. Jami qarz: ${totalSelectedDebt} so'm`);
        }

        let remainingToDistribute = paymentAmount;
        const updatedOrders = [];

        for (const o of debtOrders) {
          if (remainingToDistribute <= 0) break;
          const applyToThisOrder = Math.min(remainingToDistribute, o.debtAmount);
          
          o.paidAmount += applyToThisOrder;
          await o.save({ session }); // pre-save hook updates debtAmount

          remainingToDistribute -= applyToThisOrder;
          updatedOrders.push({ orderNumber: o.orderNumber, applied: applyToThisOrder });
        }

        // Create the payment
        const paymentData = {
          customer: customerId,
          amount: paymentAmount,
          method,
          notes: notes || (updatedOrders.length > 1 
            ? `Tanlangan buyurtmalar: ${updatedOrders.map(x => `${x.orderNumber} (${x.applied})`).join(', ')}`
            : undefined),
          receivedBy:   req.user ? req.user.name : (receivedBy || 'Tizim'),
          receivedById: req.user ? req.user._id  : undefined,
        };
        // Keep single order ref if it's only one, otherwise keep it general
        if (debtOrders.length === 1) {
          paymentData.order = debtOrders[0]._id;
        }

        const paymentArray = await Payment.create([paymentData], { session });
        const payment = paymentArray[0];

        // Update customer totalDebt using $inc
        await Customer.findByIdAndUpdate(customerId, {
          $inc: { totalDebt: -paymentAmount }
        }, { session });

        populatedPayment = await Payment.findById(payment._id)
          .populate('customer', 'name phone')
          .populate('order', 'orderNumber')
          .session(session);

        orderNumberFinal = updatedOrders.map(o => o.orderNumber).join(', ');
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

        for (const o of debtOrders) {
          if (remainingToDistribute <= 0) break;

          const applyToThisOrder = Math.min(remainingToDistribute, o.debtAmount);

          // ✅ FIX (senior): bulkWrite o'rniga har bir buyurtma uchun save() chaqiriladi.
          // Sabab: Order.bulkWrite() Mongoose pre-save hook'ni ISHLATMAYDI.
          // pre-save hook: debtAmount = totalAmount - paidAmount - cashbackUsed
          // Bu formula overrideTotalAmount va cashbackUsed ni ham to'g'ri hisobga oladi.
          // bulkWrite'dagi qo'lda $inc: {debtAmount: -X} esa bu holatlarni noto'g'ri hisoblashi mumkin.
          o.paidAmount += applyToThisOrder;
          await o.save({ session }); // pre-save hook debtAmount ni qayta hisoblaydi

          remainingToDistribute -= applyToThisOrder;
          updatedOrders.push({ orderNumber: o.orderNumber, applied: applyToThisOrder });
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
const reversePaymentAmount = async (payment, amountToReverse, session) => {
  const { order: orderId, customer: customerId } = payment;
  const Customer = require('../models/Customer');
  const Order = require('../models/Order');

  // 1. Update customer totalDebt
  await Customer.findByIdAndUpdate(customerId, {
    $inc: { totalDebt: amountToReverse }
  }, { session });

  // 2. Reverse order paidAmount
  if (orderId) {
    const order = await Order.findById(orderId).session(session);
    if (order) {
      order.paidAmount = Math.max(0, order.paidAmount - amountToReverse);
      await order.save({ session });
    }
  } else {
    // Reverse from general orders
    let remainingToReverse = amountToReverse;
    const ordersToReverse = await Order.find({
      customer: customerId,
      paidAmount: { $gt: 0 }
    }).sort({ createdAt: -1 }).session(session);

    for (const o of ordersToReverse) {
      if (remainingToReverse <= 0) break;
      const subtract = Math.min(remainingToReverse, o.paidAmount);
      o.paidAmount -= subtract;
      await o.save({ session });
      remainingToReverse -= subtract;
    }
  }
};

const applyPaymentAmount = async (payment, amountToApply, session) => {
  const { order: orderId, customer: customerId } = payment;
  const Customer = require('../models/Customer');
  const Order = require('../models/Order');

  // 1. Update customer totalDebt
  const customer = await Customer.findByIdAndUpdate(customerId, {
    $inc: { totalDebt: -amountToApply }
  }, { new: true, session });

  // 2. Apply order paidAmount
  if (orderId) {
    const order = await Order.findById(orderId).session(session);
    if (order) {
      order.paidAmount += amountToApply;
      await order.save({ session });
    }
  } else {
    // Apply to general orders
    let remainingToApply = amountToApply;
    const ordersToApply = await Order.find({
      customer: customerId,
      status: { $in: ['confirmed', 'delivered'] },
      debtAmount: { $gt: 0 }
    }).sort({ createdAt: 1 }).session(session);

    for (const o of ordersToApply) {
      if (remainingToApply <= 0) break;
      const applyToThisOrder = Math.min(remainingToApply, o.debtAmount);
      o.paidAmount += applyToThisOrder;
      await o.save({ session });
      remainingToApply -= applyToThisOrder;
    }
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
exports.updatePayment = async (req, res) => {
  const session = await require('mongoose').startSession();
  try {
    let populatedPayment;
    let paymentAmountFinal;
    let customerDoc;

    await session.withTransaction(async () => {
      const paymentId = req.params.id;
      const { amount, method, notes } = req.body;
      const newAmount = Number(amount);

      const payment = await require('../models/Payment').findById(paymentId).session(session);
      if (!payment) throw new Error("To'lov topilmadi");

      customerDoc = await require('../models/Customer').findById(payment.customer).session(session);

      const oldAmount = payment.amount;

      if (newAmount && newAmount !== oldAmount) {
        if (newAmount <= 0) throw new Error("To'lov summasi musbat bo'lishi kerak");
        
        // Check if increasing amount exceeds debt
        if (newAmount > oldAmount) {
           const diff = newAmount - oldAmount;
           if (payment.order) {
             const order = await require('../models/Order').findById(payment.order).session(session);
             if (diff > order.debtAmount) throw new Error(`Qo'shimcha to'lov buyurtma qarzdorligidan oshib ketdi`);
           } else {
             if (diff > customerDoc.totalDebt) throw new Error(`Qo'shimcha to'lov jami qarzdorlikdan oshib ketdi`);
           }
        }

        await reversePaymentAmount(payment, oldAmount, session);
        await applyPaymentAmount(payment, newAmount, session);
        payment.amount = newAmount;
      }

      if (method) payment.method = method;
      if (notes !== undefined) payment.notes = notes;

      await payment.save({ session });

      populatedPayment = await require('../models/Payment').findById(payment._id)
        .populate('customer', 'name phone')
        .populate('order', 'orderNumber')
        .session(session);
        
      paymentAmountFinal = payment.amount;
    });

    // Cleanup customer debt if it went negative
    if (customerDoc) {
      await require('../models/Customer').updateOne(
        { _id: customerDoc._id, totalDebt: { $lt: 0 } },
        { $set: { totalDebt: 0 } }
      );
    }

    const { clearDashboardCache } = require('../controllers/orderController');
    clearDashboardCache();

    // Emit socket event (optional for update)
    req.app.get('io').emit('payment:updated', { payment: populatedPayment });

    require('../utils/logger').logAction(
      req, 'PAYMENT', 'Payment', populatedPayment._id,
      `To'lov tahrirlandi: ${populatedPayment.amount} so'm (${populatedPayment.customer?.name})`
    );

    res.status(200).json({ success: true, data: populatedPayment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = async (req, res) => {
  const session = await require('mongoose').startSession();
  try {
    let paymentDoc;
    let customerDoc;

    await session.withTransaction(async () => {
      const paymentId = req.params.id;
      const payment = await require('../models/Payment').findById(paymentId).session(session);
      if (!payment) throw new Error("To'lov topilmadi");

      paymentDoc = payment;
      customerDoc = await require('../models/Customer').findById(payment.customer).session(session);

      await reversePaymentAmount(payment, payment.amount, session);

      await require('../models/Payment').findByIdAndDelete(paymentId, { session });
    });

    const { clearDashboardCache } = require('../controllers/orderController');
    clearDashboardCache();

    req.app.get('io').emit('payment:deleted', { paymentId: paymentDoc._id, customerId: customerDoc?._id });

    require('../utils/logger').logAction(
      req, 'PAYMENT', 'Payment', paymentDoc._id,
      `To'lov o'chirildi: ${paymentDoc.amount} so'm (${customerDoc?.name})`
    );

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};
