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

    const [orders, returns] = await Promise.all([
      Order.find(orderMatch)
        .populate('items.product', 'brand collection artikul images')
        .populate('customer', 'name phone type')
        .lean(),
      Return.find(returnMatch)
        .populate('items.product', 'brand collection artikul')
        .populate('customer', 'name phone type')
        .lean(),
    ]);

    // Global KPIs
    let totalRevenue = 0, totalProfit = 0, totalDebt = 0, totalQuantity = 0;
    let totalReturnAmount = 0, totalReturnedQty = 0, totalLostProfit = 0;
    
    // Breakdowns
    const paymentBreakdown = { naqd: 0, nasiya: 0, qisman: 0 };
    const typeBreakdown    = { retail: 0, wholesale: 0 };
    const dayOfWeekStats   = [0,0,0,0,0,0,0]; // Sun-Sat

    // Hash maps for deep stats
    const productStats  = {};
    const brandStats    = {};
    const customerStats = {};

    // ── PROCESS ORDERS ──
    orders.forEach((order) => {
      const amount = order.totalAmount || 0;
      const profit = order.totalProfit || 0;
      totalRevenue += amount;
      totalProfit  += profit;
      totalDebt    += order.debtAmount || 0;

      // Payment & Type
      const pt = order.paymentType || 'naqd';
      if (paymentBreakdown[pt] !== undefined) paymentBreakdown[pt] += amount;
      
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
        const sub = item.subtotal ?? (item.quantity * item.unitPrice) ?? 0;
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
    });

    // ── PROCESS RETURNS ──
    returns.forEach((ret) => {
      totalReturnAmount += ret.totalRefundAmount || 0;
      totalLostProfit   += (ret.totalRefundAmount || 0) - (ret.totalRefundCost || 0);

      // Customer returns deduction
      if (ret.customer?._id) {
        const cId = ret.customer._id.toString();
        if (customerStats[cId]) {
          customerStats[cId].revenue = Math.max(0, customerStats[cId].revenue - (ret.totalRefundAmount || 0));
          customerStats[cId].profit = Math.max(0, customerStats[cId].profit - ((ret.totalRefundAmount || 0) - (ret.totalRefundCost || 0)));
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
        productStats[pId].revenue = Math.max(0, productStats[pId].revenue - refundAmt);
        productStats[pId].cost = Math.max(0, productStats[pId].cost - refundCost);
        productStats[pId].profit = Math.max(0, productStats[pId].profit - lostProf);

        if (brandStats[brand]) {
          brandStats[brand].revenue = Math.max(0, brandStats[brand].revenue - refundAmt);
          brandStats[brand].profit = Math.max(0, brandStats[brand].profit - lostProf);
          brandStats[brand].qty = Math.max(0, brandStats[brand].qty - qty);
        }
      });
    });

    totalProfit = Math.max(0, totalProfit - totalLostProfit);
    const netRevenue  = totalRevenue - totalReturnAmount;
    const netQuantity = Math.max(0, totalQuantity - totalReturnedQty);
    const avgCheck    = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    // ── DEEP ANALYTICS FORMATTING ──
    
    // 1. ABC Analysis for Products
    const productsArray = Object.values(productStats).map(p => {
      const netQty = Math.max(0, p.soldQty - p.returnedQty);
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

    // 4. Daily Trend Chart
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

    orders.forEach(order => {
      const dateStr = getLocalYYYYMMDD(order.createdAt);
      if (chartDataMap[dateStr]) {
        chartDataMap[dateStr].savdo += order.totalAmount || 0;
        chartDataMap[dateStr].foyda += order.totalProfit || 0;
      }
    });

    returns.forEach(ret => {
      const dateStr = getLocalYYYYMMDD(ret.createdAt);
      if (chartDataMap[dateStr]) {
        chartDataMap[dateStr].vozvrat += ret.totalRefundAmount || 0;
      }
    });

    // Formatting chart arrays
    const paymentChartData = [
      { name: 'Naqd', value: paymentBreakdown.naqd, color: '#10b981' },
      { name: 'Nasiya', value: paymentBreakdown.nasiya, color: '#f59e0b' },
      { name: 'Qisman', value: paymentBreakdown.qisman, color: '#6366f1' },
    ].filter(p => p.value > 0);

    const typeChartData = [
      { name: 'Chakana (Retail)', value: typeBreakdown.retail, color: '#ec4899' },
      { name: 'Ulgurji (Wholesale)', value: typeBreakdown.wholesale, color: '#3b82f6' },
    ].filter(p => p.value > 0);

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
          profit: totalProfit, debt: totalDebt, soldQty: totalQuantity,
          returnedQty: totalReturnedQty, netQty: netQuantity,
          orders: orders.length, returnCount: returns.length, avgCheck,
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

    const [orders, returns] = await Promise.all([
      Order.find(orderMatch).populate('items.product', 'brand collection artikul').lean(),
      Return.find(returnMatch).populate('items.product', 'brand collection artikul').lean(),
    ]);

    // Aggregate product stats
    const productStats = {};
    let totalRevenue = 0, totalQuantity = 0, totalProfit = 0;

    orders.forEach((order) => {
      totalProfit += order.totalProfit || 0;
      (order.items || []).forEach((item) => {
        if (!item.product?._id) return;
        const pId = item.product._id.toString();
        if (!productStats[pId]) {
          const name = `${item.product.brand || 'Brendsiz'} ${item.product.collection || ''}`.trim() || 'Oboi';
          productStats[pId] = { name, artikul: item.product.artikul || '-', soldQty: 0, returnedQty: 0, netQty: 0, revenue: 0 };
        }
        productStats[pId].soldQty += item.quantity || 0;
        const sub = item.subtotal ?? (item.quantity * item.unitPrice) ?? 0;
        productStats[pId].revenue += sub;
        totalRevenue += sub;
        totalQuantity += item.quantity || 0;
      });
    });

    let totalReturnAmount = 0;
    let totalLostProfit   = 0;

    returns.forEach((ret) => {
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
        productStats[pId].revenue = Math.max(0, productStats[pId].revenue - (item.refundAmount || 0));
      });
    });

    totalProfit = Math.max(0, totalProfit - totalLostProfit);

    const productsArray = Object.values(productStats)
      .map((p) => ({ ...p, netQty: Math.max(0, p.soldQty - p.returnedQty) }))
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

    orders
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
