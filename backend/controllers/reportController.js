const Order = require('../models/Order');
const Return = require('../models/Return');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');
const exceljs = require('exceljs');
const telegramBot = require('../utils/telegramBot');

const generateAndSendDailyReport = async (date) => {
  try {
    // Sana uchun 'Asia/Tashkent' dagi 00:00 va 23:59 ni topamiz
    const tzDate = new Date(new Date(date).toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const offset = tzDate.getTime() - new Date(date).getTime();
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    startOfDay.setTime(startOfDay.getTime() - offset);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    endOfDay.setTime(endOfDay.getTime() - offset);

    // Bugungi savdolar (Faqat tasdiqlanganlari va yetkazilganlari)
    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'delivered'] }
    }).populate('warehouse', 'name');

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalDiscount = 0;
    let totalOrders = orders.length;
    const byBranch = {};

    orders.forEach(order => {
      totalRevenue += order.totalAmount || 0;
      totalProfit += order.totalProfit || 0;
      totalDiscount += order.discount || 0;

      const whName = order.warehouse?.name || 'Noma\'lum filial';
      if (!byBranch[whName]) {
        byBranch[whName] = { revenue: 0, orders: 0 };
      }
      byBranch[whName].revenue += order.totalAmount || 0;
      byBranch[whName].orders += 1;
    });

    // Bugungi vozvratlar
    const returns = await Return.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    let totalReturns = 0;
    returns.forEach(ret => {
      totalReturns += ret.totalRefundAmount || 0;
    });

    const stats = {
      date: startOfDay,
      totalOrders,
      totalRevenue,
      totalProfit,
      totalDiscount,
      totalReturns,
      branches: byBranch
    };

    const success = await telegramBot.sendDailyReport(stats);

    // Endi har bir filial uchun alohida hisobot shakllantiramiz va yuboramiz
    const allWarehouses = await Warehouse.find().select('name _id telegramChatId').lean();
    for (const wh of allWarehouses) {
      if (!wh.telegramChatId) continue; // Filialning telegram guruhi yo'q

      const whId = wh._id.toString();
      const whOrders = orders.filter(o => o.warehouse && o.warehouse._id.toString() === whId);
      const whReturns = returns.filter(r => r.warehouse && r.warehouse.toString() === whId || (r.warehouse && r.warehouse._id && r.warehouse._id.toString() === whId));

      let whRevenue = 0;
      let whProfit = 0;
      let whDiscount = 0;
      whOrders.forEach(o => {
        whRevenue += o.totalAmount || 0;
        whProfit += o.totalProfit || 0;
        whDiscount += o.discount || 0;
      });

      let whTotalReturns = 0;
      whReturns.forEach(r => {
        whTotalReturns += r.totalRefundAmount || 0;
      });

      const whStats = {
        date: startOfDay,
        totalOrders: whOrders.length,
        totalRevenue: whRevenue,
        totalProfit: whProfit,
        totalDiscount: whDiscount,
        totalReturns: whTotalReturns
      };

      // Faqatgina ushbu filial uchun kunlik hisobot yuborish
      await telegramBot.sendBranchDailyReport(whStats, whId, wh.name);
    }

    return { success, stats };
  } catch (error) {
    console.error("Kunlik hisobot xatosi:", error);
    return { success: false, error: error.message };
  }
};

exports.sendManualReport = async (req, res) => {
  try {
    const date = new Date();
    const result = await generateAndSendDailyReport(date);
    
    if (result.success) {
      res.status(200).json({ success: true, message: "Hisobot Telegramga muvaffaqiyatli yuborildi!", data: result.stats });
    } else {
      res.status(500).json({ success: false, message: "Hisobot yuborishda xatolik yuz berdi." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateAndSendDailyReport = generateAndSendDailyReport;

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let match = { status: { $ne: 'cancelled' } };
    
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const orders = await Order.find(match).populate('items.product', 'brand collection artikul images').lean();

    let totalRevenue = 0;
    let totalOrders = orders.length;
    let totalQuantity = 0;

    const productStats = {};

    orders.forEach(order => {
       const amount = order.totalAmount || 0;
       totalRevenue += amount;

       order.items.forEach(item => {
         if (item.product && item.product._id) {
            const pId = item.product._id.toString();
            if (!productStats[pId]) {
              const pBrand = item.product.brand || 'Brendsiz';
              const pCollection = item.product.collection || '';
              let pName = `${pBrand} ${pCollection}`.trim();
              if (pName === 'Brendsiz') pName = 'Oboi';

              productStats[pId] = {
                id: pId,
                name: pName,
                artikul: item.product.artikul || '-',
                image: item.product.images && item.product.images.length > 0 ? item.product.images[0].url : null,
                quantity: 0,
                revenue: 0
              };
            }
            productStats[pId].quantity += item.quantity;
            productStats[pId].revenue += (item.subtotal || (item.quantity * item.unitPrice) || 0);
            totalQuantity += item.quantity;
         }
       });
    });

    const productsArray = Object.values(productStats).sort((a,b) => b.revenue - a.revenue);

    const chartDataMap = {};
    let startD, endD;
    
    if (startDate && endDate) {
      startD = new Date(startDate);
      endD = new Date(endDate);
    } else if (startDate) {
      startD = new Date(startDate);
      endD = new Date();
    } else if (endDate) {
      endD = new Date(endDate);
      startD = new Date(endD);
      startD.setDate(startD.getDate() - 29);
    } else {
      endD = new Date();
      startD = new Date();
      startD.setDate(startD.getDate() - 29);
    }
    
    startD.setHours(0,0,0,0);
    
    const diffDays = Math.floor((endD - startD) / (1000 * 60 * 60 * 24));
    const cappedDays = Math.max(0, Math.min(diffDays, 90)); // Max 90 days for chart to prevent huge arrays
    
    for (let i = 0; i <= cappedDays; i++) {
      const d = new Date(startD);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}`;
      chartDataMap[dateStr] = { date: dateStr, displayDate, savdo: 0 };
    }

    orders.forEach(order => {
       const orderDate = new Date(order.createdAt);
       const dateStr = orderDate.toISOString().split('T')[0];
       if (chartDataMap[dateStr]) {
          chartDataMap[dateStr].savdo += (order.totalAmount || 0);
       }
    });

    const chartData = Object.values(chartDataMap);

    res.json({
       success: true,
       data: {
         kpi: {
           revenue: totalRevenue,
           orders: totalOrders,
           quantity: totalQuantity
         },
         products: productsArray,
         chartData
       }
    });

  } catch (error) {
    console.error('getSalesReport error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportSalesExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let match = { status: { $ne: 'cancelled' } };
    
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      };
    }

    const orders = await Order.find(match).populate('items.product', 'brand collection artikul').lean();

    const productStats = {};
    let totalRevenue = 0;
    let totalQuantity = 0;

    orders.forEach(order => {
       order.items.forEach(item => {
         if (item.product && item.product._id) {
            const pId = item.product._id.toString();
            if (!productStats[pId]) {
              const pBrand = item.product.brand || 'Brendsiz';
              const pCollection = item.product.collection || '';
              let pName = `${pBrand} ${pCollection}`.trim();
              if (pName === 'Brendsiz') pName = 'Oboi';

              productStats[pId] = {
                name: pName,
                artikul: item.product.artikul || '-',
                quantity: 0,
                revenue: 0
              };
            }
            productStats[pId].quantity += item.quantity;
            productStats[pId].revenue += (item.subtotal || (item.quantity * item.unitPrice) || 0);
            
            totalRevenue += (item.subtotal || (item.quantity * item.unitPrice) || 0);
            totalQuantity += item.quantity;
         }
       });
    });

    const productsArray = Object.values(productStats).sort((a,b) => b.revenue - a.revenue);

    const workbook = new exceljs.Workbook();
    workbook.creator = 'OBOI CRM Hisobotlar';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Sotuvlar Hisoboti', {
      properties: { defaultColWidth: 20 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }]
    });

    sheet.mergeCells('A1:E2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Premium Sotuvlar Hisoboti (Artikul/Mahsulot)';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; 

    sheet.mergeCells('A4:B4');
    const kpi1Title = sheet.getCell('A4');
    kpi1Title.value = 'Jami Sotilgan (Rulon)';
    kpi1Title.font = { bold: true };
    kpi1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    sheet.mergeCells('A5:B5');
    const kpi1Value = sheet.getCell('A5');
    kpi1Value.value = totalQuantity;
    kpi1Value.font = { size: 14, bold: true, color: { argb: 'FF047857' } };

    sheet.mergeCells('D4:E4');
    const kpi2Title = sheet.getCell('D4');
    kpi2Title.value = 'Jami Tushum (so\'m)';
    kpi2Title.font = { bold: true };
    kpi2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    sheet.mergeCells('D5:E5');
    const kpi2Value = sheet.getCell('D5');
    kpi2Value.value = totalRevenue;
    kpi2Value.font = { size: 14, bold: true, color: { argb: 'FF4338CA' } };
    kpi2Value.numFmt = '#,##0" so\'m"';

    let currentRow = 7;
    const headers = ['#', 'Mahsulot nomi', 'Artikul', 'Sotilgan Qismi', 'Umumiy Tushum'];
    const headerRow = sheet.getRow(currentRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
    
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 25;

    currentRow++;

    productsArray.forEach((row, index) => {
      const dataRow = sheet.getRow(currentRow);
      dataRow.values = [index + 1, row.name, row.artikul, row.quantity, row.revenue];
      
      dataRow.getCell(4).alignment = { horizontal: 'center' };
      dataRow.getCell(5).numFmt = '#,##0" so\'m"'; 

      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });

      currentRow++;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Hisobotlar_Export.xlsx"');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

