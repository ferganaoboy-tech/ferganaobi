const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Return = require('../models/Return');
const telegramBot = require('../utils/telegramBot');
const { logAction } = require('../utils/logger');

const NodeCache = require('node-cache');
const dashboardCache = new NodeCache({ stdTTL: 600 }); // cache for 10 minutes

// ─── Cache Stampede Protection (In-flight deduplication) ─────────────────────
// Bir vaqtda kelgan ko'p so'rovlar DB'ga faqat bir marta aggregation yuboradi
const inFlight = new Map();

// Helper to clear cache
exports.clearDashboardCache = () => {
  const keys = dashboardCache.keys();
  keys.forEach(key => {
    if (key.startsWith('orderStats')) {
      dashboardCache.del(key);
    }
  });
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public
exports.getOrders = async (req, res) => {
  try {
    const { status, paymentType, type, customer, warehouse, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && status !== 'Barchasi') query.status = typeof status === 'string' ? status : undefined;
    if (paymentType && paymentType !== 'Barchasi') query.paymentType = typeof paymentType === 'string' ? paymentType : undefined;
    if (type && type !== 'Barchasi') query.type = type === 'Optom' ? 'wholesale' : 'retail';
    if (customer) query.customer = typeof customer === 'string' ? customer : undefined;
    
    // ── Enforce Role-based Warehouse Access ──
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      query.warehouse = req.user.warehouse;
    } else if (warehouse) {
      query.warehouse = typeof warehouse === 'string' ? warehouse : undefined;
    }

    if (req.query.search) {
      query.orderNumber = { $regex: req.query.search, $options: 'i' };
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
    const total = await Order.countDocuments(query);

    let sortObj = { createdAt: -1 };
    if (req.query.sort === 'oldest') {
      sortObj = { createdAt: 1 };
    }

    const orders = await Order.find(query)
      .populate('customer', 'name phone')
      .populate('warehouse', 'name')
      .populate('seller', 'name')
      .populate('items.product', 'brand artikul polka images category')
      .sort(sortObj)
      .skip(startIndex)
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: orders,
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

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Public
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer')
      .populate('warehouse')
      .populate('seller', 'name')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      const oWarehouse = order.warehouse._id ? order.warehouse._id.toString() : order.warehouse.toString();
      if (oWarehouse !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: "Siz boshqa filial buyurtmasini ko'ra olmaysiz." });
      }
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const { processOrder } = require('../services/orderService');

// @desc    Create order
// @route   POST /api/orders
// @access  Public
exports.createOrder = async (req, res) => {
  try {
    const io = req.app.get('io');
    const populatedOrder = await processOrder(req.body, req.user, io);
    res.status(201).json({ success: true, data: populatedOrder });
  } catch (error) {
    if (error.message.includes('Siz faqat') || error.message.includes('Not enough stock') || error.message.includes('Product not found') || error.message.includes('Skladda yetarli')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm order
// @route   PUT /api/orders/:id/confirm
// @access  Public
exports.confirmOrder = async (req, res) => {
  // ✅ FIX #1: To'liq MongoDB transaction — manual rollback o'rniga atom operatsiya
  const session = await mongoose.startSession();
  try {
    const io = req.app.get('io');
    let confirmedOrder;
    let stockUpdates = [];

    await session.withTransaction(async () => {
      stockUpdates = [];

      const order = await Order.findById(req.params.id).session(session);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // ✅ FIX: IDOR Himoyasi — Boshqa filial buyurtmasini o'zgartirish man etiladi
      if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
        const docWh = order.warehouse?._id?.toString() || order.warehouse?.toString();
        if (docWh !== req.user.warehouse.toString()) {
          throw new Error('Siz boshqa filial buyurtmasini tasdiqlay olmaysiz.');
        }
      }

      if (order.status !== 'pending') {
        throw new Error('Faqat kutilayotgan buyurtmalarni tasdiqlash mumkin');
      }

      // Atomic stock deduction — xatolik bo'lsa transaction avtomatik rollback
      for (let item of order.items) {
        const product = await Product.findOneAndUpdate(
          { _id: item.product, quantity: { $gte: item.quantityInRolls } },
          { $inc: { quantity: -item.quantityInRolls, soldQuantity: item.quantityInRolls } },
          { new: true, session }
        ).populate('warehouse', 'name');

        if (!product) {
          const currentProduct = await Product.findById(item.product).session(session);
          throw new Error(
            `Skladda yetarli mahsulot yo'q: ${currentProduct ? (currentProduct.brand || currentProduct.artikul) : "Noma'lum"}. Mavjud: ${currentProduct ? currentProduct.quantity : 0} ta`
          );
        }

        stockUpdates.push({ id: item.product, quantity: item.quantityInRolls, productDoc: product });
      }

      // Update order status
      order.status = 'confirmed';
      order.confirmedAt = new Date();
      await order.save({ session });

      // Update customer debt and total purchased
      await Customer.findByIdAndUpdate(order.customer, {
        $inc: {
          totalDebt: Math.max(0, order.debtAmount),
          totalPurchased: order.totalAmount
        }
      }, { session });

      confirmedOrder = order;
    });

    // ─── Side effects (transaction tashqarisida — faqat muvaffaqiyatdan keyin) ───
    const syncDeltas = {
      products: stockUpdates.map(u => ({ id: u.id.toString(), delta: -u.quantity })),
      customer: {
        id: confirmedOrder.customer.toString(),
        debtDelta: Math.max(0, confirmedOrder.debtAmount),
        purchasedDelta: confirmedOrder.totalAmount
      }
    };

    // ✅ FIX: Low stock bildirishnomalar — faqat tegishli warehouse room'iga yuboriladi
    // io.emit() barcha clientlarga yuborardi; io.to(whId) faqat tegishli filial xodimlariga
    for (const upd of stockUpdates) {
      if (upd.productDoc.quantity <= upd.productDoc.minStock) {
        const productWhId = upd.productDoc.warehouse?._id?.toString() || upd.productDoc.warehouse?.toString();
        const lowStockPayload = {
          product: { brand: upd.productDoc.brand, artikul: upd.productDoc.artikul },
          quantity: upd.productDoc.quantity,
          minStock: upd.productDoc.minStock,
          warehouse: { name: upd.productDoc.warehouse?.name }
        };
        // Tegishli filial va globalga (superadmin/admin uchun)
        if (productWhId) {
          io.to(productWhId).emit('stock:low', lowStockPayload);
        }
        io.to('global_admins').emit('stock:low', lowStockPayload);
        telegramBot.sendLowStockWarning(upd.productDoc).catch(err =>
          console.error('Telegram sklad xatosi:', err)
        );
      }
    }

    const whId = confirmedOrder.warehouse?._id || confirmedOrder.warehouse;
    io.to(whId.toString()).emit('order:confirmed', { order: confirmedOrder, syncDeltas });

    // Cache invalidation
    exports.clearDashboardCache();

    await logAction(req, 'UPDATE', 'Order', confirmedOrder._id, `Buyurtma tasdiqlandi: ${confirmedOrder.orderNumber}`);
    res.status(200).json({ success: true, data: confirmedOrder });
  } catch (error) {
    const status = (error.message === 'Order not found') ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Public
exports.cancelOrder = async (req, res) => {
  // ✅ FIX #6 + Transaction: previousStatus saqlanadi, atomic operatsiya
  const session = await mongoose.startSession();
  try {
    const io = req.app.get('io');
    let cancelledOrder;
    let previousStatus;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw new Error('Order not found');
      
      if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
        const docWh = order.warehouse?._id?.toString() || order.warehouse?.toString();
        if (docWh !== req.user.warehouse.toString()) {
          throw new Error('Siz boshqa filial buyurtmasini bekor qila olmaysiz.');
        }
      }

      if (order.status === 'cancelled') throw new Error('Already cancelled');

      // ✅ FIX #6: Eski statusni OLDIN saqlaymiz
      previousStatus = order.status;

      if (previousStatus === 'confirmed' || previousStatus === 'delivered') {
        // Atomic stock restore
        for (let item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: item.quantityInRolls, soldQuantity: -item.quantityInRolls } },
            { session }
          );
        }

        // Va to'langan pullarni minus qarz (store credit) qilib o'tkazish
        await Customer.findByIdAndUpdate(order.customer, {
          $inc: {
            totalDebt: -Math.max(0, order.debtAmount) - Math.max(0, order.paidAmount),
            totalPurchased: -order.totalAmount
          }
        }, { session });

        // Store credit uchun totalDebt manfiy bo'lishiga ruxsat beramiz.
        // Safety: totalDebt check olib tashlandi.

        // Reverse cashback
        const cashbackDelta = (order.cashbackUsed || 0) - (order.cashbackEarned || 0);
        if (cashbackDelta !== 0) {
          await Customer.findByIdAndUpdate(order.customer, {
            $inc: { cashbackBalance: cashbackDelta }
          }, { session });
          // Safety: cashbackBalance never negative
          await Customer.updateOne(
            { _id: order.customer, cashbackBalance: { $lt: 0 } },
            { $set: { cashbackBalance: 0 } },
            { session }
          );
        }
      }

      order.status = 'cancelled';
      await order.save({ session });
      cancelledOrder = order;
    });

    // ─── Side effects (transaction tashqarisida) ───
    // ✅ FIX #6: previousStatus ga asoslanib syncDeltas (order.status emas!)
    let syncDeltas = null;
    if (previousStatus === 'confirmed' || previousStatus === 'delivered') {
      syncDeltas = {
        products: cancelledOrder.items.map(item => ({
          id: item.product.toString(),
          delta: item.quantityInRolls
        })),
        customer: {
          id: cancelledOrder.customer.toString(),
          debtDelta: -Math.max(0, cancelledOrder.debtAmount),
          purchasedDelta: -cancelledOrder.totalAmount
        }
      };
    }

    const whId = cancelledOrder.warehouse?._id || cancelledOrder.warehouse;
    io.to(whId.toString()).emit('order:cancelled', { order: cancelledOrder, syncDeltas });

    // Cache invalidation
    exports.clearDashboardCache();

    await logAction(req, 'UPDATE', 'Order', cancelledOrder._id, `Buyurtma bekor qilindi: ${cancelledOrder.orderNumber}`);
    res.status(200).json({ success: true, data: cancelledOrder });
  } catch (error) {
    const status = (error.message === 'Order not found') ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  } finally {
    await session.endSession();
  }
};

// @desc    Update order status to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Public
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      const docWh = order.warehouse?._id?.toString() || order.warehouse?.toString();
      if (docWh !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: 'Siz boshqa filial buyurtmasini holatini o\'zgartira olmaysiz.' });
      }
    }

    if (['cancelled', 'returned'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Bu holatga o\'zgartirish uchun bekor qilish yoki qaytarish maxsus API lari ishlatilishi shart.' });
    }

    if (order.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Only confirmed orders can be delivered' });
    }

    order.status = status;
    if (status === 'delivered') order.deliveredAt = new Date();
    await order.save();

    const whId = order.warehouse?._id || order.warehouse;
    req.app.get('io').to(whId.toString()).emit('order:updated', order);
    await logAction(req, 'UPDATE', 'Order', order._id, `Buyurtma holati o'zgardi: ${order.orderNumber} -> ${status}`);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── Internal computeStats (cache stampede guard bilan ishlatiladi) ──────────
// ✅ FIX: Barcha aggregation so'rovlari Promise.all() bilan PARALLEL yuboriladi.
// Ilgari 10 ta ketma-ket so'rov → sekin birinchi yuklash (cache yo'q holatda).
// Endi barcha so'rovlar bir vaqtda MongoDB'ga ketadi → ~8-10x tez.
async function computeOrderStats(warehouseId = null) {
  const baseOrderMatch = { status: { $ne: 'cancelled' } };
  const baseReturnMatch = { $or: [{ order: { $exists: false } }, { order: null }] };
  if (warehouseId) {
    baseOrderMatch.warehouse = new (require('mongoose')).Types.ObjectId(warehouseId);
    baseReturnMatch.warehouse = new (require('mongoose')).Types.ObjectId(warehouseId);
  }
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Monthly start hisoblash (Asia/Tashkent vaqtida)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', year: 'numeric', month: 'numeric' });
  const parts = formatter.formatToParts(now);
  const tzYear = parts.find(p => p.type === 'year').value;
  const tzMonth = parts.find(p => p.type === 'month').value.padStart(2, '0');
  const startOfMonth = new Date(`${tzYear}-${tzMonth}-01T00:00:00+05:00`);

  // ✅ Barcha 10 ta so'rov bir vaqtda parallel yuboriladi
  const [
    dailySalesRaw,
    dailyQuickReturns,
    monthlyRevenueResult,
    monthlyQRResult,
    totalRevenueResult,
    totalQRResult,
    revenueByWarehouse,
    warehouseReturns,
    topCustomers,
    paymentTypeStats,
    orderTypeStats,
  ] = await Promise.all([
    // 1. Daily sales last 30 days — timezone: Asia/Tashkent
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, ...baseOrderMatch } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Tashkent"
            }
          },
          amount: { $sum: "$totalAmount" },
          profit: { $sum: "$totalProfit" }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // 2. Daily quick returns last 30 days
    Return.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, ...baseReturnMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Tashkent" } },
          refund: { $sum: "$totalRefundAmount" },
          refundCost: { $sum: "$totalRefundCost" }
        }
      }
    ]),

    // 3. Monthly revenue (current month)
    Order.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, ...baseOrderMatch } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, profit: { $sum: "$totalProfit" } } }
    ]),

    // 4. Monthly quick returns
    Return.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, ...baseReturnMatch } },
      { $group: { _id: null, refund: { $sum: "$totalRefundAmount" }, refundCost: { $sum: "$totalRefundCost" } } }
    ]),

    // 5. Total all-time revenue
    Order.aggregate([
      { $match: { ...baseOrderMatch } },
      { $group: { _id: null, total: { $sum: "$totalAmount" }, profit: { $sum: "$totalProfit" } } }
    ]),

    // 6. Total all-time quick returns
    Return.aggregate([
      { $match: { ...baseReturnMatch } },
      { $group: { _id: null, refund: { $sum: "$totalRefundAmount" }, refundCost: { $sum: "$totalRefundCost" } } }
    ]),

    // 7. Revenue by warehouse
    Order.aggregate([
      { $match: { ...baseOrderMatch } },
      { $group: { _id: "$warehouse", total: { $sum: "$totalAmount" }, profit: { $sum: "$totalProfit" } } },
      { $lookup: { from: 'warehouses', localField: '_id', foreignField: '_id', as: 'warehouseInfo' } },
      { $unwind: { path: "$warehouseInfo", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, name: "$warehouseInfo.name", color: "$warehouseInfo.color", total: 1, profit: 1 } }
    ]),

    // 8. Returns by warehouse
    Return.aggregate([
      { $match: { ...baseReturnMatch } },
      { $group: { _id: "$warehouse", refund: { $sum: "$totalRefundAmount" }, refundCost: { $sum: "$totalRefundCost" } } }
    ]),

    // 9. Top customers
    Order.aggregate([
      { $match: { ...baseOrderMatch } },
      { $group: { _id: "$customer", total: { $sum: "$totalAmount" } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customerInfo' } },
      { $unwind: "$customerInfo" },
      { $project: { name: "$customerInfo.name", total: 1 } }
    ]),

    // 10. Sales by payment type
    Order.aggregate([
      { $match: { ...baseOrderMatch } },
      { $group: { _id: "$paymentType", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
    ]),

    // 11. Sales by order type
    Order.aggregate([
      { $match: { ...baseOrderMatch } },
      { $group: { _id: "$type", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
    ]),
  ]);

  // ─── Natijalarni hisoblash ─────────────────────────────────────────────────

  // Daily sales + quick returns merge
  const quickReturnsMap = {};
  dailyQuickReturns.forEach(qr => { quickReturnsMap[qr._id] = qr; });
  const dailySales = dailySalesRaw.map(ds => {
    const qr = quickReturnsMap[ds._id];
    if (qr) {
      return {
        _id: ds._id,
        amount: Math.max(0, ds.amount - qr.refund),
        profit: Math.max(0, ds.profit - (qr.refund - qr.refundCost))
      };
    }
    return ds;
  });

  // Monthly
  const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
  const monthlyProfit  = monthlyRevenueResult[0]?.profit || 0;
  const mQRRefund      = monthlyQRResult[0]?.refund || 0;
  const mQRRefundCost  = monthlyQRResult[0]?.refundCost || 0;
  const finalMonthlyRevenue = Math.max(0, monthlyRevenue - mQRRefund);
  const finalMonthlyProfit  = Math.max(0, monthlyProfit - (mQRRefund - mQRRefundCost));

  // Total all-time
  const totalRevenue  = totalRevenueResult[0]?.total || 0;
  const totalProfit   = totalRevenueResult[0]?.profit || 0;
  const tQRRefund     = totalQRResult[0]?.refund || 0;
  const tQRRefundCost = totalQRResult[0]?.refundCost || 0;
  const finalTotalRevenue = Math.max(0, totalRevenue - tQRRefund);
  const finalTotalProfit  = Math.max(0, totalProfit - (tQRRefund - tQRRefundCost));

  // FIX: Ayrim omborlar bo'yicha qaytarilgan tovarlar summasini ayirish
  const warehouseReturnsMap = {};
  warehouseReturns.forEach(wr => {
    warehouseReturnsMap[wr._id?.toString()] = { refund: wr.refund, refundCost: wr.refundCost };
  });
  revenueByWarehouse.forEach(rw => {
    const returnData = warehouseReturnsMap[rw._id?.toString()] || { refund: 0, refundCost: 0 };
    rw.total  = Math.max(0, rw.total  - returnData.refund);
    rw.profit = Math.max(0, rw.profit - (returnData.refund - returnData.refundCost));
  });

  return {
    success: true,
    data: {
      dailySales,
      monthlyRevenue: finalMonthlyRevenue,
      monthlyProfit: finalMonthlyProfit,
      totalRevenue: finalTotalRevenue,
      totalProfit: finalTotalProfit,
      revenueByWarehouse,
      topCustomers,
      paymentTypeStats,
      orderTypeStats
    }
  };
}


// @desc    Get order stats
// @route   GET /api/orders/stats
// @access  Public
exports.getOrderStats = async (req, res) => {
  // ✅ FIX: cacheKey ni try tashqarisida e'lon qilamiz — catch blokida ham mavjud bo'ladi
  let cacheKey = 'orderStats_all';
  try {
    // ✅ Cache Stampede himoyasi — in-flight deduplication
    let warehouseId = null;
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      warehouseId = req.user.warehouse.toString();
    }
    cacheKey = 'orderStats_' + (warehouseId || 'all');

    const cachedStats = dashboardCache.get(cacheKey);
    if (cachedStats) {
      return res.status(200).json(cachedStats);
    }

    // Agar boshqa so'rov allaqachon DB'dan hisoblayapti bo'lsa — kutamiz
    if (inFlight.has(cacheKey)) {
      const responseData = await inFlight.get(cacheKey);
      return res.status(200).json(responseData);
    }

    // Yangi hisoblash boshlaymiz — promise'ni in-flight map'ga qo'shamiz
    const computePromise = computeOrderStats(warehouseId);
    inFlight.set(cacheKey, computePromise);

    try {
      const responseData = await computePromise;
      dashboardCache.set(cacheKey, responseData);
      res.status(200).json(responseData);
    } finally {
      inFlight.delete(cacheKey);
    }
  } catch (error) {
    // cacheKey har doim aniq — try blokidan tashqarida e'lon qilingan
    inFlight.delete(cacheKey);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send receipt image to Telegram
// @route   POST /api/orders/:id/send-receipt
// @access  Public
exports.sendReceiptImage = async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name')
      .populate('seller', 'name')
      .populate('items.product', 'brand artikul polka category');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      const docWh = order.warehouse?._id?.toString() || order.warehouse?.toString();
      if (docWh !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: 'Siz boshqa filial buyurtmasi chekini yubora olmaysiz.' });
      }
    }

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    const success = await telegramBot.sendReceiptPhoto(order, imageBase64);

    if (success) {
      res.status(200).json({ success: true, message: 'Chek Telegramga yuborildi' });
    } else {
      res.status(500).json({ success: false, message: 'Telegramga yuborishda xatolik yuz berdi' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
