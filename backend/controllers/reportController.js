const Order = require('../models/Order');
const Return = require('../models/Return');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');
const exceljs = require('exceljs');
const telegramBot = require('../utils/telegramBot');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toshkent vaqt zonasini hisobga olib sanani UTC boshiga o'tkazish
 */
const toUTCStart = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00+05:00`);
  return d;
};

const toUTCEnd = (dateStr) => {
  const d = new Date(`${dateStr}T23:59:59.999+05:00`);
  return d;
};

// ─────────────────────────────────────────────────────────────────────────────
// TELEGRAM DAILY REPORT
// ─────────────────────────────────────────────────────────────────────────────

const generateAndSendDailyReport = async (date) => {
  try {
    const tzDate = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
    const offset = tzDate.getTime() - new Date(date).getTime();

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    startOfDay.setTime(startOfDay.getTime() - offset);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    endOfDay.setTime(endOfDay.getTime() - offset);

    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'delivered'] },
    }).populate('warehouse', 'name');

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalDiscount = 0;
    const totalOrders = orders.length;
    const byBranch = {};

    orders.forEach((order) => {
      totalRevenue += order.totalAmount || 0;
      totalProfit += order.totalProfit || 0;
      totalDiscount += order.discount || 0;

      const whName = order.warehouse?.name || "Noma'lum filial";
      if (!byBranch[whName]) byBranch[whName] = { revenue: 0, orders: 0 };
      byBranch[whName].revenue += order.totalAmount || 0;
      byBranch[whName].orders += 1;
    });

    const returns = await Return.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
    let totalReturns = 0;
    returns.forEach((ret) => { totalReturns += ret.totalRefundAmount || 0; });

    const stats = { date: startOfDay, totalOrders, totalRevenue, totalProfit, totalDiscount, totalReturns, branches: byBranch };
    const success = await telegramBot.sendDailyReport(stats);

    const allWarehouses = await Warehouse.find().select('name _id telegramChatId').lean();
    for (const wh of allWarehouses) {
      if (!wh.telegramChatId) continue;
      const whId = wh._id.toString();
      const whOrders = orders.filter((o) => o.warehouse && o.warehouse._id.toString() === whId);
      const whReturns = returns.filter(
        (r) => r.warehouse && (r.warehouse.toString() === whId || (r.warehouse._id && r.warehouse._id.toString() === whId))
      );

      let whRevenue = 0, whProfit = 0, whDiscount = 0, whTotalReturns = 0;
      whOrders.forEach((o) => { whRevenue += o.totalAmount || 0; whProfit += o.totalProfit || 0; whDiscount += o.discount || 0; });
      whReturns.forEach((r) => { whTotalReturns += r.totalRefundAmount || 0; });

      await telegramBot.sendBranchDailyReport(
        { date: startOfDay, totalOrders: whOrders.length, totalRevenue: whRevenue, totalProfit: whProfit, totalDiscount: whDiscount, totalReturns: whTotalReturns },
        whId, wh.name
      );
    }

    return { success, stats };
  } catch (error) {
    console.error('Kunlik hisobot xatosi:', error);
    return { success: false, error: error.message };
  }
};

exports.sendManualReport = async (req, res) => {
  try {
    const result = await generateAndSendDailyReport(new Date());
    if (result.success) {
      res.status(200).json({ success: true, message: 'Hisobot Telegramga muvaffaqiyatli yuborildi!', data: result.stats });
    } else {
      res.status(500).json({ success: false, message: 'Hisobot yuborishda xatolik yuz berdi.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateAndSendDailyReport = generateAndSendDailyReport;

// ─────────────────────────────────────────────────────────────────────────────
// GET SALES REPORT  (DEEP ANALYTICS ENDPOINT)
// ─────────────────────────────────────────────────────────────────────────────

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const buildDateFilter = () => {
      if (!startDate && !endDate) return {};
      const filter = {};
      if (startDate) filter.$gte = toUTCStart(startDate);
      if (endDate)   filter.$lte = toUTCEnd(endDate);
      return filter;
    };
    const dateFilter = buildDateFilter();

    const orderMatch = {
      status: { $nin: ['cancelled'] },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    const returnMatch = {
      status: 'completed',
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    // 4. Daily Trend Chart Initialization
    let startD, endD;
    if (startDate && endDate) { startD = toUTCStart(startDate); endD = toUTCEnd(endDate); }
    else if (startDate) { startD = toUTCStart(startDate); endD = new Date(); }
    else if (endDate) { endD = toUTCEnd(endDate); startD = new Date(endD); startD.setDate(startD.getDate() - 29); }
    else { endD = new Date(); startD = new Date(); startD.setDate(startD.getDate() - 29); }

    const diffDays  = Math.floor((endD - startD) / 86400000);
    const cappedDays = Math.min(Math.max(diffDays, 0), 90);
    const chartDataMap = {};
    
    const getLocalYYYYMMDD = (dateStrOrObj) => {
      const d = new Date(new Date(dateStrOrObj).toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    for (let i = 0; i <= cappedDays; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = getLocalYYYYMMDD(d);
      const displayDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      chartDataMap[dateStr] = { date: dateStr, displayDate, savdo: 0, vozvrat: 0, foyda: 0 };
    }

    // 🔥 FIX: 512MB RAM ni crash qilishdan saqlash uchun Cursor / Streaming qo'llanilmoqda
    // O(N) memory o'rniga O(1) memory ishlatiladi, minglab buyurtmalar bittadan aylanadi
    const orderCursor = Order.find(orderMatch)
      .populate('items.product', 'brand collection artikul images')
      .populate('customer', 'name phone type')
      .lean().cursor();

    const returnCursor = Return.find(returnMatch)
      .populate('items.product', 'brand collection artikul')
      .populate('customer', 'name phone type')
      .lean().cursor();

    // Global KPIs
    let totalRevenue = 0, totalProfit = 0, totalDebt = 0, totalQuantity = 0;
    let totalReturnAmount = 0, totalReturnedQty = 0, totalLostProfit = 0;
    let ordersLength = 0;
    let returnsLength = 0;
    
    // Breakdowns
    let totalNaqdPaid = 0; // Actual cash/card collected
    const typeBreakdown    = { retail: 0, wholesale: 0 };
    const dayOfWeekStats   = [0,0,0,0,0,0,0]; // Sun-Sat

    // Hash maps for deep stats
    const productStats  = {};
    const brandStats    = {};
    const customerStats = {};

    // ── PROCESS ORDERS (Stream) ──
    for await (const order of orderCursor) {
      ordersLength++;
      const amount = order.totalAmount || 0;
      const profit = order.totalProfit || 0;
      totalRevenue += amount;
      totalProfit  += profit;
      totalDebt    += order.debtAmount || 0;
      totalNaqdPaid += order.paidAmount || 0;

      // Chart data
      const dateStr = getLocalYYYYMMDD(order.createdAt);
      if (chartDataMap[dateStr]) {
        chartDataMap[dateStr].savdo += amount;
        chartDataMap[dateStr].foyda += profit;
      }

      // Type Breakdown
      const ct = order.type || (order.customer?.type) || 'retail';
      if (typeBreakdown[ct] !== undefined) typeBreakdown[ct] += amount;

      // Day of week (0=Sun, 6=Sat)
      const day = new Date(order.createdAt).getDay();
      dayOfWeekStats[day] += amount;

      // Customer stats
      if (order.customer?._id) {
        const cId = order.customer._id.toString();
        if (!customerStats[cId]) {
          customerStats[cId] = { 
            id: cId, name: order.customer.name, phone: order.customer.phone, 
            type: ct, revenue: 0, profit: 0, ordersCount: 0 
          };
        }
        customerStats[cId].revenue += amount;
        customerStats[cId].profit += profit;
        customerStats[cId].ordersCount += 1;
      }

      // ✅ FIX: Global Discount (overrideTotalAmount) ni mahsulotlar kesimiga tarqatish
      // Busiz Mahsulotlar (ABC) tahlilida daromad noto'g'ri (shishib ketgan) bo'lib qoladi.
      let calculatedOrderTotal = 0;
      (order.items || []).forEach(i => {
        calculatedOrderTotal += (i.unitPrice * i.quantity) * (1 - (i.discount || 0) / 100);
      });
      const hasGlobalDiscount = order.overrideTotalAmount !== undefined && order.overrideTotalAmount !== null;
      const globalDiscountRatio = (hasGlobalDiscount && calculatedOrderTotal > 0) 
        ? (order.overrideTotalAmount / calculatedOrderTotal) 
        : 1;

      // Product stats
      (order.items || []).forEach((item) => {
        if (!item.product?._id) return;

        const pId = item.product._id.toString();
        const brand = item.product.brand || 'Brendsiz';
        
        if (!productStats[pId]) {
          const collection = item.product.collection || '';
          const name = `${brand} ${collection}`.trim() || 'Oboi';
          productStats[pId] = {
            id: pId, name, brand, artikul: item.product.artikul || '-',
            image: item.product.images?.[0]?.url || null,
            soldQty: 0, returnedQty: 0, revenue: 0, cost: 0, profit: 0
          };
        }

        const qty = item.quantity || 0;
        
        // Asl subtotal
        const rawSub = (item.unitPrice * qty) * (1 - (item.discount || 0) / 100);
        // Chegirma qo'llanilgan yakuniy subtotal
        const sub = rawSub * globalDiscountRatio;
        
        const cost = (item.unitCost || 0) * qty;
        
        productStats[pId].soldQty += qty;
        productStats[pId].revenue += sub;
        productStats[pId].cost    += cost;
        productStats[pId].profit  += (sub - cost);
        totalQuantity += qty;

        // Brand stats
        if (!brandStats[brand]) brandStats[brand] = { name: brand, revenue: 0, profit: 0, qty: 0 };
        brandStats[brand].revenue += sub;
        brandStats[brand].profit  += (sub - cost);
        brandStats[brand].qty     += qty;
      });
    }

    // ── PROCESS RETURNS (Stream) ──
    for await (const ret of returnCursor) {
      returnsLength++;
      const rAmount = ret.totalRefundAmount || 0;
      totalReturnAmount += rAmount;
      totalLostProfit   += rAmount - (ret.totalRefundCost || 0);

      // Chart data
      const dateStr = getLocalYYYYMMDD(ret.createdAt);
      if (chartDataMap[dateStr]) {
        chartDataMap[dateStr].vozvrat += rAmount;
      }

      // Customer returns deduction
      if (ret.customer?._id) {
        const cId = ret.customer._id.toString();
        if (customerStats[cId]) {
          customerStats[cId].revenue = customerStats[cId].revenue - rAmount;
          customerStats[cId].profit = customerStats[cId].profit - (rAmount - (ret.totalRefundCost || 0));
        }
      }

      (ret.items || []).forEach((item) => {
        if (!item.product?._id) return;
        const pId = item.product._id.toString();
        const qty = item.quantity || 0;
        const refundAmt = item.refundAmount || 0;
        const refundCost = (item.unitCost || 0) * qty;
        const lostProf = refundAmt - refundCost;
        
        totalReturnedQty += qty;

        const brand = item.product.brand || 'Brendsiz';

        if (!productStats[pId]) {
          const collection = item.product.collection || '';
          const name = `${brand} ${collection}`.trim() || 'Oboi';
          productStats[pId] = {
            id: pId, name, brand, artikul: item.product.artikul || '-',
            image: item.product.images?.[0]?.url || null,
            soldQty: 0, returnedQty: 0, revenue: 0, cost: 0, profit: 0
          };
        }

        productStats[pId].returnedQty += qty;
        productStats[pId].revenue = productStats[pId].revenue - refundAmt;
        productStats[pId].cost = productStats[pId].cost - refundCost;
        productStats[pId].profit = productStats[pId].profit - lostProf;

        if (brandStats[brand]) {
          brandStats[brand].revenue = brandStats[brand].revenue - refundAmt;
          brandStats[brand].profit = brandStats[brand].profit - lostProf;
          brandStats[brand].qty = brandStats[brand].qty - qty;
        }
      });
    }

    // Matematikada sof foyda (net profit) manfiy bo'lishi mumkin (agar vozvrat savdodan oshib ketsa)
    // Shu sababli Math.max(0, ...) olib tashlandi — bu haqiqiy moliya talabi (Senior qadam).
    totalProfit = totalProfit - totalLostProfit;
    const netRevenue  = totalRevenue - totalReturnAmount;
    const netQuantity = totalQuantity - totalReturnedQty;
    const avgCheck    = ordersLength > 0 ? Math.round(totalRevenue / ordersLength) : 0;

    // ── DEEP ANALYTICS FORMATTING ──
    
    // 1. ABC Analysis for Products
    const productsArray = Object.values(productStats).map(p => {
      const netQty = p.soldQty - p.returnedQty;
      const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
      const returnRate = p.soldQty > 0 ? (p.returnedQty / p.soldQty) * 100 : 0;
      return { ...p, netQty, margin, returnRate };
    }).sort((a, b) => b.revenue - a.revenue);

    let cummulativeRev = 0;
    productsArray.forEach(p => {
      cummulativeRev += p.revenue;
      const percentage = netRevenue > 0 ? (cummulativeRev / netRevenue) * 100 : 0;
      if (percentage <= 80) p.abc = 'A';
      else if (percentage <= 95) p.abc = 'B';
      else p.abc = 'C';
    });

    const top5Products = productsArray.slice(0, 5).map(p => ({
      name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
      revenue: p.revenue, qty: p.netQty, margin: p.margin
    }));

    // 2. Customer Analytics (Top 10)
    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 3. Brand Analytics
    const brandsArray = Object.values(brandStats)
      .filter(b => b.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

      // Formatting chart arrays
      const paymentChartData = [
        { name: 'Naqd', value: totalNaqdPaid, color: '#10b981' },
        { name: 'Nasiya', value: totalDebt, color: '#f59e0b' },
      ].filter(p => p.value > 0);

    const typeChartData = [
      { name: 'Ulgurji', value: typeBreakdown.retail, color: '#ec4899' },
      { name: 'Sotuv', value: typeBreakdown.wholesale, color: '#3b82f6' },
    ].filter(d => d.value > 0);

    const daysOfWeekNames = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    const weekTrendData = dayOfWeekStats.map((val, idx) => ({
      name: daysOfWeekNames[idx],
      value: val
    }));

    res.json({
      success: true,
      data: {
        kpi: {
          revenue: totalRevenue, netRevenue, returnAmount: totalReturnAmount,
          profit: totalProfit, debt: totalDebt, naqd: totalNaqdPaid, soldQty: totalQuantity,
          returnedQty: totalReturnedQty, netQty: netQuantity,
          orders: ordersLength, returnCount: returnsLength, avgCheck,
          marginPercent: netRevenue > 0 ? (totalProfit / netRevenue) * 100 : 0
        },
        paymentChartData, typeChartData, weekTrendData,
        top5Products, products: productsArray,
        topCustomers, brands: brandsArray,
        chartData: Object.values(chartDataMap),
      },
    });
  } catch (error) {
    console.error('getSalesReport (DEEP) error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// EXPORT EXCEL  — professional, multi-sheet
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET CAPITAL REPORT  — Tikilgan kapital hisoboti (Senior-level)
// ─────────────────────────────────────────────────────────────────────────────
// Mantiq:
//   Har bir mahsulot uchun: tikilganPul = costPrice × quantity
//   Umumiy tikilgan kapital = Σ(costPrice × quantity)
//   Artikul bo'yicha filterlash → bitta mahsulotning kapitalini alohida ko'rish
//
// GET /api/reports/capital?warehouse=...&artikul=...&category=...
// ─────────────────────────────────────────────────────────────────────────────

exports.getCapitalReport = async (req, res) => {
  try {
    const { warehouse, artikul, category } = req.query;

    // ── Match filter ────────────────────────────────────────────────────────
    const matchStage = { isActive: true, quantity: { $gt: 0 } };

    // Foydalanuvchi roli: oddiy admin faqat o'z skladini ko'rishi mumkin
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      matchStage.warehouse = req.user.warehouse;
    } else if (warehouse && warehouse !== 'all') {
      const mongoose = require('mongoose');
      matchStage.warehouse = new mongoose.Types.ObjectId(warehouse);
    }

    if (artikul) {
      matchStage.artikul = { $regex: artikul.trim(), $options: 'i' };
    }

    if (category) {
      matchStage.category = category;
    }

    // ── MongoDB Aggregation Pipeline ────────────────────────────────────────
    const pipeline = [
      { $match: matchStage },

      // Har bir mahsulot uchun tikilgan pul hisoblash
      {
        $addFields: {
          investedAmount:    { $multiply: ['$costPrice',    '$quantity'] }, // UZS
          investedAmountUsd: { $multiply: [{ $ifNull: ['$costPriceUsd', 0] }, '$quantity'] }, // USD
          potentialRevenue:  { $multiply: ['$pricePerRoll', '$quantity'] }, // Sotilsa keladigan pul
          potentialProfit: {
            $multiply: [
              { $subtract: ['$pricePerRoll', '$costPrice'] },
              '$quantity'
            ]
          },
          marginPercent: {
            $cond: [
              { $gt: ['$pricePerRoll', 0] },
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$pricePerRoll', '$costPrice'] }, '$pricePerRoll'] },
                  100
                ]
              },
              0
            ]
          }
        }
      },

      // Warehouse ma'lumotini ulash
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouse',
          foreignField: '_id',
          as: 'warehouseInfo',
          pipeline: [{ $project: { name: 1, color: 1 } }]
        }
      },
      { $unwind: { path: '$warehouseInfo', preserveNullAndEmptyArrays: true } },

      // Qaytarish kerak bo'lgan maydonlarni tanlash
      {
        $project: {
          _id: 1,
          brand: 1,
          artikul: 1,
          collection: 1,
          category: 1,
          unit: 1,
          polka: 1,
          costPrice: 1,
          costPriceUsd: { $ifNull: ['$costPriceUsd', 0] },
          pricePerRoll: 1,
          quantity: 1,
          soldQuantity: 1,
          minStock: 1,
          investedAmount: 1,
          investedAmountUsd: 1,
          potentialRevenue: 1,
          potentialProfit: 1,
          marginPercent: { $round: ['$marginPercent', 1] },
          warehouseName: '$warehouseInfo.name',
          warehouseColor: '$warehouseInfo.color',
          images: { $slice: ['$images', 1] }
        }
      },

      // Eng ko'p kapital tikilgandan kamiga saralash
      { $sort: { investedAmount: -1 } },
    ];

    const products = await Product.aggregate(pipeline);

    // ── Umumiy KPI hisoblash ─────────────────────────────────────────────────
    const summary = products.reduce((acc, p) => {
      acc.totalInvested    += p.investedAmount    || 0;
      acc.totalInvestedUsd += p.investedAmountUsd || 0;
      acc.totalPotentialRevenue += p.potentialRevenue || 0;
      acc.totalPotentialProfit  += p.potentialProfit  || 0;
      acc.totalItems       += 1;
      acc.totalQuantity    += p.quantity || 0;
      return acc;
    }, {
      totalInvested: 0,
      totalInvestedUsd: 0,
      totalPotentialRevenue: 0,
      totalPotentialProfit: 0,
      totalItems: 0,
      totalQuantity: 0,
    });

    // Umumiy o'rtacha margin
    summary.avgMarginPercent = summary.totalPotentialRevenue > 0
      ? parseFloat(((summary.totalPotentialProfit / summary.totalPotentialRevenue) * 100).toFixed(1))
      : 0;

    // ── Kategorial breakdown (warehouse bo'yicha guruhlash) ──────────────────
    const byWarehouse = {};
    products.forEach(p => {
      const wName = p.warehouseName || "Noma'lum";
      if (!byWarehouse[wName]) {
        byWarehouse[wName] = { name: wName, color: p.warehouseColor, invested: 0, items: 0, quantity: 0 };
      }
      byWarehouse[wName].invested  += p.investedAmount || 0;
      byWarehouse[wName].items     += 1;
      byWarehouse[wName].quantity  += p.quantity || 0;
    });

    // ── Category breakdown ───────────────────────────────────────────────────
    const byCategory = {};
    products.forEach(p => {
      const cat = p.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { name: cat, invested: 0, items: 0, quantity: 0 };
      byCategory[cat].invested  += p.investedAmount || 0;
      byCategory[cat].items     += 1;
      byCategory[cat].quantity  += p.quantity || 0;
    });

    res.json({
      success: true,
      data: {
        summary,
        products,
        byWarehouse: Object.values(byWarehouse).sort((a, b) => b.invested - a.invested),
        byCategory:  Object.values(byCategory).sort((a, b) => b.invested - a.invested),
      }
    });

  } catch (error) {
    console.error('getCapitalReport error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT CAPITAL EXCEL  — Tikilgan kapital Excel eksport
// ─────────────────────────────────────────────────────────────────────────────

exports.exportCapitalExcel = async (req, res) => {
  try {
    const { warehouse, artikul, category } = req.query;

    const matchStage = { isActive: true, quantity: { $gt: 0 } };

    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      matchStage.warehouse = req.user.warehouse;
    } else if (warehouse && warehouse !== 'all') {
      const mongoose = require('mongoose');
      matchStage.warehouse = new mongoose.Types.ObjectId(warehouse);
    }
    if (artikul)  matchStage.artikul  = { $regex: artikul.trim(), $options: 'i' };
    if (category) matchStage.category = category;

    const products = await Product.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          investedAmount:   { $multiply: ['$costPrice',    '$quantity'] },
          potentialRevenue: { $multiply: ['$pricePerRoll', '$quantity'] },
          potentialProfit:  { $multiply: [{ $subtract: ['$pricePerRoll', '$costPrice'] }, '$quantity'] },
          marginPercent: {
            $cond: [
              { $gt: ['$pricePerRoll', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$pricePerRoll', '$costPrice'] }, '$pricePerRoll'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'warehouses', localField: 'warehouse', foreignField: '_id', as: 'warehouseInfo',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: { path: '$warehouseInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          warehouseName: '$warehouseInfo.name'
        }
      },
      { $sort: { investedAmount: -1 } }
    ]);

    const totalInvested       = products.reduce((s, p) => s + (p.investedAmount    || 0), 0);
    const totalPotRevenue     = products.reduce((s, p) => s + (p.potentialRevenue  || 0), 0);
    const totalPotProfit      = products.reduce((s, p) => s + (p.potentialProfit   || 0), 0);

    // ── Build Excel ──────────────────────────────────────────────────────────
    const workbook  = new exceljs.Workbook();
    workbook.creator = 'OBOI CRM — Capital Report';
    workbook.created = new Date();

    const DARK   = 'FF1F2937';
    const GREEN  = 'FF059669';
    const INDIGO = 'FF4F46E5';
    const AMBER  = 'FFD97706';
    const WHITE  = 'FFFFFFFF';
    const LIGHT  = 'FFF9FAFB';
    const BORDER = 'FFE5E7EB';
    const RED    = 'FFDC2626';

    const styleCell = (cell, opts = {}) => {
      if (opts.bold !== undefined) cell.font = { bold: opts.bold, size: opts.size || 11, color: opts.color ? { argb: opts.color } : undefined };
      if (opts.bg)   cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
      if (opts.align) cell.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: false };
      if (opts.numFmt) cell.numFmt = opts.numFmt;
      cell.border = { top: { style: 'thin', color: { argb: BORDER } }, left: { style: 'thin', color: { argb: BORDER } }, bottom: { style: 'thin', color: { argb: BORDER } }, right: { style: 'thin', color: { argb: BORDER } } };
    };

    const sheet = workbook.addWorksheet('💰 Tikilgan Kapital', {
      properties: { defaultColWidth: 18 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }]
    });

    // Title
    sheet.mergeCells('A1:J2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '💰  OBOI CRM — Tikilgan Kapital Hisoboti';
    titleCell.font  = { size: 18, bold: true, color: { argb: WHITE } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Period
    sheet.mergeCells('A3:J3');
    const subCell = sheet.getCell('A3');
    subCell.value = `Eksport: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}${artikul ? '  |  Artikul: ' + artikul : ''}${category ? '  |  Kategoriya: ' + category : ''}`;
    subCell.font  = { size: 11, italic: true, color: { argb: '555555' } };
    subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.getRow(4).height = 8;

    // KPI summary row
    const kpis = [
      { label: 'Jami Tikilgan Pul', value: totalInvested,   fmt: '#,##0" UZS"', color: RED   },
      { label: 'Potentsial Tushum', value: totalPotRevenue, fmt: '#,##0" UZS"', color: GREEN  },
      { label: 'Potentsial Foyda',  value: totalPotProfit,  fmt: '#,##0" UZS"', color: INDIGO },
      { label: 'Mahsulot soni',     value: products.length, fmt: '#,##0',        color: DARK   },
    ];

    const kpiLabel = sheet.getRow(5); kpiLabel.height = 20;
    const kpiValue = sheet.getRow(6); kpiValue.height = 28;
    kpis.forEach((k, i) => {
      const lc = kpiLabel.getCell(i * 2 + 1); lc.value = k.label;
      styleCell(lc, { bold: true, size: 10, bg: 'FFF3F4F6', align: 'center', color: '555555' });
      sheet.mergeCells(5, i * 2 + 1, 5, i * 2 + 2);
      const vc = kpiValue.getCell(i * 2 + 1); vc.value = k.value; vc.numFmt = k.fmt;
      styleCell(vc, { bold: true, size: 13, align: 'center', color: k.color, bg: LIGHT });
      sheet.mergeCells(6, i * 2 + 1, 6, i * 2 + 2);
    });

    sheet.getRow(7).height = 8;

    // Table headers
    const headers = ['#', 'Brend', 'Artikul', 'Kolleksiya', 'Polka', 'Sklad', 'Tan Narxi', 'Dona', 'Tikilgan Pul', 'Sot. Narxi', 'Pot. Tushum', 'Pot. Foyda', 'Margin %'];
    const colWidths = [5, 18, 18, 18, 10, 16, 16, 8, 20, 16, 20, 20, 12];
    const hRow = sheet.getRow(8); hRow.height = 26;
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1); cell.value = h;
      styleCell(cell, { bold: true, size: 10, bg: DARK, color: WHITE, align: 'center' });
      sheet.getColumn(i + 1).width = colWidths[i];
    });

    // Data rows
    products.forEach((p, idx) => {
      const r = sheet.getRow(idx + 9); r.height = 20;
      const bg = idx % 2 === 0 ? WHITE : LIGHT;
      const margin = p.marginPercent || 0;
      const marginColor = margin >= 30 ? GREEN : margin >= 15 ? AMBER : RED;

      const vals = [
        idx + 1, p.brand || '-', p.artikul || '-', p.collection || '-', p.polka || '-',
        p.warehouseName || '-',
        p.costPrice || 0, p.quantity || 0, p.investedAmount || 0,
        p.pricePerRoll || 0, p.potentialRevenue || 0, p.potentialProfit || 0,
        parseFloat((p.marginPercent || 0).toFixed(1))
      ];

      vals.forEach((v, i) => {
        const cell = r.getCell(i + 1); cell.value = v;
        const isMoneyCol = [6, 8, 9, 10, 11].includes(i);
        const isMarginCol = i === 12;
        styleCell(cell, {
          bg,
          align: i === 1 || i === 2 || i === 3 ? 'left' : 'center',
          numFmt: isMoneyCol ? '#,##0" UZS"' : isMarginCol ? '0.0"%"' : undefined,
          color: isMarginCol ? marginColor : i === 8 ? RED : DARK,
          bold: i === 8,
        });
      });
    });

    // Totals
    const tRow = sheet.getRow(products.length + 9); tRow.height = 26;
    const totals = ['', 'JAMI', '', '', '', '', '', products.reduce((s, p) => s + p.quantity, 0), totalInvested, '', totalPotRevenue, totalPotProfit, ''];
    totals.forEach((v, i) => {
      const cell = tRow.getCell(i + 1); cell.value = v;
      const isMoneyCol = [7, 10, 11].includes(i);
      const isTikilgan = i === 8;
      styleCell(cell, {
        bold: true, size: 12, bg: DARK, color: WHITE, align: 'center',
        numFmt: (isMoneyCol || isTikilgan) ? '#,##0" UZS"' : undefined
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="OBOI_Kapital_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('exportCapitalExcel error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportSalesExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const buildDateFilter = () => {
      if (!startDate && !endDate) return {};
      const f = {};
      if (startDate) f.$gte = toUTCStart(startDate);
      if (endDate)   f.$lte = toUTCEnd(endDate);
      return f;
    };
    const dateFilter = buildDateFilter();

    const orderMatch = {
      status: { $nin: ['cancelled'] },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    const returnMatch = {
      status: 'completed',
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    // 🔥 FIX: Excel generatsiyasida ham RAM to'lib qolmasligi uchun Cursor ishlatamiz
    const orderCursor = Order.find(orderMatch)
      .populate('items.product', 'brand collection artikul')
      .lean().cursor();

    const returnCursor = Return.find(returnMatch)
      .populate('items.product', 'brand collection artikul')
      .lean().cursor();

    // Aggregate product stats
    const productStats = {};
    let totalRevenue = 0, totalQuantity = 0, totalProfit = 0;
    const ordersList = []; // Excel varag'iga yozish uchun baribir kerak, lekin biz uni streamdan to'plab boramiz. Idealda Excelni ham stream bilan yozish kerak, lekin 10-20k object array Node.js da 50-60MB oladi (Mongoose documentdan ko'ra ming marta yengil).

    for await (const order of orderCursor) {
      ordersList.push(order); // pastki qism (sheet 2) uchun
      totalProfit += order.totalProfit || 0;
      
      let calculatedOrderTotal = 0;
      (order.items || []).forEach(i => {
        calculatedOrderTotal += (i.unitPrice * i.quantity) * (1 - (i.discount || 0) / 100);
      });
      const hasGlobalDiscount = order.overrideTotalAmount !== undefined && order.overrideTotalAmount !== null;
      const globalDiscountRatio = (hasGlobalDiscount && calculatedOrderTotal > 0) 
        ? (order.overrideTotalAmount / calculatedOrderTotal) 
        : 1;

      (order.items || []).forEach((item) => {
        if (!item.product?._id) return;
        const pId = item.product._id.toString();
        if (!productStats[pId]) {
          const name = `${item.product.brand || 'Brendsiz'} ${item.product.collection || ''}`.trim() || 'Oboi';
          productStats[pId] = { name, artikul: item.product.artikul || '-', soldQty: 0, returnedQty: 0, netQty: 0, revenue: 0 };
        }
        productStats[pId].soldQty += item.quantity || 0;
        
        const rawSub = (item.unitPrice * item.quantity) * (1 - (item.discount || 0) / 100);
        const sub = rawSub * globalDiscountRatio;
        
        productStats[pId].revenue += sub;
        totalRevenue += sub;
        totalQuantity += item.quantity || 0;
      });
    }

    let totalReturnAmount = 0;
    let totalLostProfit   = 0;

    for await (const ret of returnCursor) {
      totalReturnAmount += ret.totalRefundAmount || 0;
      totalLostProfit   += (ret.totalRefundAmount || 0) - (ret.totalRefundCost || 0);

      (ret.items || []).forEach((item) => {
        if (!item.product?._id) return;
        const pId = item.product._id.toString();
        if (!productStats[pId]) {
          const name = `${item.product.brand || 'Brendsiz'} ${item.product.collection || ''}`.trim() || 'Oboi';
          productStats[pId] = { name, artikul: item.product.artikul || '-', soldQty: 0, returnedQty: 0, netQty: 0, revenue: 0 };
        }
        productStats[pId].returnedQty += item.quantity || 0;
        productStats[pId].revenue = productStats[pId].revenue - (item.refundAmount || 0);
      });
    }

    totalProfit = totalProfit - totalLostProfit;

    const productsArray = Object.values(productStats)
      .map((p) => ({ ...p, netQty: p.soldQty - p.returnedQty }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Build Workbook ─────────────────────────────────────────────────────────
    const workbook = new exceljs.Workbook();
    workbook.creator = 'OBOI CRM — Professional Analytics';
    workbook.created = new Date();

    const DARK   = 'FF1F2937';
    const GREEN  = 'FF059669';
    const RED    = 'FFDC2626';
    const INDIGO = 'FF4F46E5';
    const WHITE  = 'FFFFFFFF';
    const LIGHT  = 'FFF9FAFB';
    const BORDER = 'FFE5E7EB';

    const styleCell = (cell, opts = {}) => {
      if (opts.bold !== undefined)      cell.font = { ...(cell.font || {}), bold: opts.bold, size: opts.size || 11, color: opts.color ? { argb: opts.color } : undefined };
      if (opts.bg)                      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
      if (opts.align)                   cell.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: opts.wrap || false };
      if (opts.numFmt)                  cell.numFmt = opts.numFmt;
      if (opts.border !== false)        cell.border = { top: { style: 'thin', color: { argb: BORDER } }, left: { style: 'thin', color: { argb: BORDER } }, bottom: { style: 'thin', color: { argb: BORDER } }, right: { style: 'thin', color: { argb: BORDER } } };
    };

    // ── Sheet 1: Summary ───────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('📊 Umumiy Hisobot', {
      properties: { defaultColWidth: 22 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 7 }],
    });

    const periodLabel = startDate && endDate
      ? `${startDate} — ${endDate}`
      : startDate ? `${startDate} dan` : endDate ? `${endDate} gacha` : 'Barcha davr';

    // Title
    summarySheet.mergeCells('A1:F2');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `🏪  OBOI CRM — Savdo Hisoboti`;
    titleCell.font  = { size: 18, bold: true, color: { argb: WHITE } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Period
    summarySheet.mergeCells('A3:F3');
    const periodCell = summarySheet.getCell('A3');
    periodCell.value = `Davr: ${periodLabel}  |  Eksport: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;
    periodCell.font  = { size: 11, italic: true, color: { argb: '666666' } };
    periodCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Blank separator
    summarySheet.getRow(4).height = 8;

    // KPI row labels + values
    const kpiItems = [
      { label: 'Jami Tushum',       value: totalRevenue,           fmt: '#,##0" UZS"', color: DARK  },
      { label: 'Sof Tushum',        value: totalRevenue - totalReturnAmount, fmt: '#,##0" UZS"', color: GREEN },
      { label: 'Vozvrat Summasi',   value: totalReturnAmount,      fmt: '#,##0" UZS"', color: RED   },
      { label: 'Sof Foyda',         value: totalProfit,            fmt: '#,##0" UZS"', color: INDIGO },
      { label: 'Sotilgan (rulon)',  value: totalQuantity,          fmt: '#,##0',        color: DARK  },
      { label: 'Buyurtmalar',       value: orders.length,          fmt: '#,##0',        color: DARK  },
    ];

    const kpiLabelRow = summarySheet.getRow(5);
    const kpiValueRow = summarySheet.getRow(6);
    kpiLabelRow.height = 22;
    kpiValueRow.height = 28;

    kpiItems.forEach((kpi, i) => {
      const col = i + 1;
      const lCell = kpiLabelRow.getCell(col);
      lCell.value = kpi.label;
      styleCell(lCell, { bold: true, size: 10, bg: 'FFF3F4F6', align: 'center', color: '555555', border: false });

      const vCell = kpiValueRow.getCell(col);
      vCell.value  = kpi.value;
      vCell.numFmt = kpi.fmt;
      styleCell(vCell, { bold: true, size: 13, align: 'center', color: kpi.color, bg: LIGHT, border: false });
    });

    summarySheet.getRow(7).height = 8;

    // Table header row
    const headers = ['#', 'Mahsulot Nomi', 'Artikul', 'Sotildi', 'Qaytdi', 'Sof Sotuv', 'Tushum (UZS)'];
    const headerRow = summarySheet.getRow(8);
    headerRow.height = 26;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      styleCell(cell, { bold: true, size: 11, bg: DARK, color: WHITE, align: 'center', border: false });
    });

    summarySheet.getColumn(1).width = 5;
    summarySheet.getColumn(2).width = 36;
    summarySheet.getColumn(3).width = 22;
    summarySheet.getColumn(4).width = 14;
    summarySheet.getColumn(5).width = 14;
    summarySheet.getColumn(6).width = 14;
    summarySheet.getColumn(7).width = 24;

    let row = 9;
    productsArray.forEach((p, idx) => {
      const dataRow = summarySheet.getRow(row);
      dataRow.height = 22;
      const bg = idx % 2 === 0 ? WHITE : LIGHT;

      const vals = [idx + 1, p.name, p.artikul, p.soldQty, p.returnedQty, p.netQty, p.revenue];
      vals.forEach((v, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.value = v;
        styleCell(cell, {
          bg,
          align: i === 1 ? 'left' : 'center',
          numFmt: i === 6 ? '#,##0" UZS"' : undefined,
          color: i === 4 && p.returnedQty > 0 ? RED : DARK,
          bold: i === 6,
        });
      });
      row++;
    });

    // Totals row
    const totalsRow = summarySheet.getRow(row);
    totalsRow.height = 26;
    const totalsVals = ['', 'JAMI', '', productsArray.reduce((s, p) => s + p.soldQty, 0), productsArray.reduce((s, p) => s + p.returnedQty, 0), productsArray.reduce((s, p) => s + p.netQty, 0), totalRevenue - totalReturnAmount];
    totalsVals.forEach((v, i) => {
      const cell = totalsRow.getCell(i + 1);
      cell.value = v;
      styleCell(cell, { bold: true, size: 12, bg: DARK, color: WHITE, align: i === 1 ? 'left' : 'center', numFmt: i === 6 ? '#,##0" UZS"' : undefined });
    });

    // ── Sheet 2: Orders List ───────────────────────────────────────────────────
    const ordersSheet = workbook.addWorksheet('📋 Buyurtmalar', {
      properties: { defaultColWidth: 18 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }],
    });

    const orderHeaders = ['#', 'Buyurtma №', 'Sana', "To'lov", 'Status', 'Jami (UZS)', "To'langan (UZS)", 'Qarz (UZS)', 'Foyda (UZS)'];
    const oHeaderRow = ordersSheet.getRow(1);
    oHeaderRow.height = 26;
    orderHeaders.forEach((h, i) => {
      const cell = oHeaderRow.getCell(i + 1);
      cell.value = h;
      styleCell(cell, { bold: true, size: 11, bg: INDIGO, color: WHITE, align: 'center', border: false });
    });
    ordersSheet.getColumn(1).width = 6;
    ordersSheet.getColumn(2).width = 18;
    ordersSheet.getColumn(3).width = 20;
    ordersSheet.getColumn(4).width = 14;
    ordersSheet.getColumn(5).width = 14;
    ordersSheet.getColumn(6).width = 22;
    ordersSheet.getColumn(7).width = 22;
    ordersSheet.getColumn(8).width = 22;
    ordersSheet.getColumn(9).width = 22;

    const statusMap = { confirmed: 'Tasdiqlangan', delivered: "Yetkazilgan", pending: 'Kutilmoqda', cancelled: 'Bekor' };
    const payMap    = { naqd: 'Naqd', nasiya: 'Nasiya', qisman: 'Qisman' };

    ordersList
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((order, idx) => {
        const oRow = ordersSheet.getRow(idx + 2);
        oRow.height = 20;
        const bg = idx % 2 === 0 ? WHITE : LIGHT;
        const sana = new Date(order.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const vals = [
          idx + 1,
          order.orderNumber || '-',
          sana,
          payMap[order.paymentType] || order.paymentType || '-',
          statusMap[order.status]   || order.status || '-',
          order.totalAmount  || 0,
          order.paidAmount   || 0,
          order.debtAmount   || 0,
          order.totalProfit  || 0,
        ];
        vals.forEach((v, i) => {
          const cell = oRow.getCell(i + 1);
          cell.value = v;
          const isDebt   = i === 7 && v > 0;
          const isProfit = i === 8;
          styleCell(cell, {
            bg,
            align: i <= 1 ? 'center' : i === 2 ? 'left' : 'center',
            numFmt: i >= 5 ? '#,##0" UZS"' : undefined,
            color: isDebt ? RED : isProfit ? GREEN : DARK,
            bold: i >= 5,
          });
        });
      });

    // ── Response ───────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="OBOI_Hisobot_${new Date().toISOString().split('T')[0]}.xlsx"`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
