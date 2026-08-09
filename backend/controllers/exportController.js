const exceljs = require('exceljs');
const Product = require('../models/Product');
const Order = require('../models/Order');

exports.exportAiAnalyticsExcel = async (req, res) => {
  try {
    const { chartImage } = req.body; // Base64 image from frontend

    // 1. Prepare Product Data Table & Calculate Metrics First
    const products = await Product.find({}, 'name artikul quantity pricePerRoll collection').lean();
    const orders = await Order.find({ status: { $ne: 'cancelled' } }).populate('items.product', '_id').lean();
    
    const salesData = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product && item.product._id) {
          const prodId = item.product._id.toString();
          salesData[prodId] = (salesData[prodId] || 0) + item.quantity;
        }
      });
    });

    const tableData = products.map(p => ({
      name: p.name,
      artikul: p.artikul,
      collection: p.collection || '-',
      stock: p.quantity,
      price: p.pricePerRoll || 0,
      sold: salesData[p._id.toString()] || 0,
      revenue: (salesData[p._id.toString()] || 0) * (p.pricePerRoll || 0)
    })).sort((a, b) => b.sold - a.sold); // Sort by sold descending

    const totalSold = tableData.reduce((sum, item) => sum + item.sold, 0);
    const totalRevenue = tableData.reduce((sum, item) => sum + item.revenue, 0);
    const totalStock = tableData.reduce((sum, item) => sum + item.stock, 0);

    // 2. Initialize Excel Workbook
    const workbook = new exceljs.Workbook();
    workbook.creator = 'OBOI CRM AI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('AI Tahlil Hisoboti', {
      properties: { defaultColWidth: 20 },
      views: [{ state: 'frozen', xSplit: 0, ySplit: 25 }] // Freeze top 25 rows
    });

    // 3. Add Header Title (A1:G2)
    sheet.mergeCells('A1:G2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'AI Senior Analitik Hisoboti';
    titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Gray-800

    // 4. Create Beautiful KPI Cards
    // Card 1: Jami Sotilgan (A4:C6)
    sheet.mergeCells('A4:C4');
    const kpi1Title = sheet.getCell('A4');
    kpi1Title.value = 'Jami Sotilgan Mahsulotlar (Rulon)';
    kpi1Title.font = { size: 9, bold: true, color: { argb: 'FF4B5563' } }; // Gray-600
    kpi1Title.alignment = { vertical: 'middle', horizontal: 'center' };
    kpi1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Gray-100

    sheet.mergeCells('A5:C6');
    const kpi1Value = sheet.getCell('A5');
    kpi1Value.value = `${totalSold.toLocaleString('ru-RU')} rulon`;
    kpi1Value.font = { size: 16, bold: true, color: { argb: 'FF047857' } }; // Green-700
    kpi1Value.alignment = { vertical: 'middle', horizontal: 'center' };
    kpi1Value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E7DD' } }; // Light Green

    // Card 1 Borders
    for (let r = 4; r <= 6; r++) {
      for (let c = 1; c <= 3; c++) {
        sheet.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      }
    }

    // Card 2: Jami Tushum (E4:G6)
    sheet.mergeCells('E4:G4');
    const kpi2Title = sheet.getCell('E4');
    kpi2Title.value = 'Jami Umumiy Tushum (so\'m)';
    kpi2Title.font = { size: 9, bold: true, color: { argb: 'FF4B5563' } };
    kpi2Title.alignment = { vertical: 'middle', horizontal: 'center' };
    kpi2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

    sheet.mergeCells('E5:G6');
    const kpi2Value = sheet.getCell('E5');
    kpi2Value.value = `${totalRevenue.toLocaleString('ru-RU')} so'm`;
    kpi2Value.font = { size: 16, bold: true, color: { argb: 'FF4338CA' } }; // Indigo-700
    kpi2Value.alignment = { vertical: 'middle', horizontal: 'center' };
    kpi2Value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Light Indigo

    // Card 2 Borders
    for (let r = 4; r <= 6; r++) {
      for (let c = 5; c <= 7; c++) {
        sheet.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      }
    }

    // 5. Add Chart Image if provided (Rows 8 to 22)
    if (chartImage) {
      const base64Data = chartImage.replace(/^data:image\/\w+;base64,/, '');
      const imageId = workbook.addImage({
        base64: base64Data,
        extension: 'png',
      });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 7 }, // Cell A8
        ext: { width: 900, height: 320 }, // Preserve original aspect ratio instead of squashing
        editAs: 'oneCell'
      });
    }

    // 6. Draw Product Data Table (Starts at row 24)
    let currentRow = 24;

    // Headers
    const headers = ['Mahsulot nomi', 'Artikul', 'Kolleksiya', 'Narx (Rulon)', 'Qoldiq (Rulon)', 'Sotilgan (Rulon)', 'Umumiy Tushum'];
    const headerRow = sheet.getRow(currentRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF312E81' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF312E81' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
    currentRow++;

    // Data Rows
    const startDataRow = currentRow;
    tableData.forEach(row => {
      const dataRow = sheet.getRow(currentRow);
      dataRow.values = [row.name, row.artikul, row.collection, row.price, row.stock, row.sold, row.revenue];
      
      // Formatting prices and revenues with Uzbek Soum format
      dataRow.getCell(4).numFmt = '#,##0" so\'m"'; 
      dataRow.getCell(7).numFmt = '#,##0" so\'m"'; 

      // Alignment
      dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      dataRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
      
      // Conditional Formatting for Stock (Red if 0, Yellow if <= 20)
      const stockCell = dataRow.getCell(5);
      if (row.stock === 0) {
        stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Red-100
        stockCell.font = { color: { argb: 'FF991B1B' } }; // Red-800
      } else if (row.stock <= 20) {
        stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; // Yellow-100
        stockCell.font = { color: { argb: 'FF854D0E' } }; // Yellow-800
      }

      // Add borders to each data cell
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

    // 7. Add Grand Total Row
    const totalRow = sheet.getRow(currentRow);
    totalRow.getCell(1).value = 'JAMI YAKUNIY KO\'RSATKICHLAR';
    totalRow.getCell(5).value = totalStock;
    totalRow.getCell(6).value = totalSold;
    totalRow.getCell(7).value = totalRevenue;

    // Format totals
    totalRow.getCell(7).numFmt = '#,##0" so\'m"'; 
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    totalRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    totalRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    totalRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    // Total Row Styling
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: 'FF1E1B4B' } }; // Dark indigo text
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo-100
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF4F46E5' } }, // Double bottom border for classic accounting feel
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    const endDataRow = currentRow;
    currentRow++;

    // 8. Add Excel Conditional Formatting if there are data rows
    // Removed conditional formatting due to ExcelJS syntax incompatibility causing 500 errors.
    // Basic formatting is already applied via borders and fills.

    // 9. Auto-fit column widths (ignoring title/KPI cards which would stretch columns unreasonably)
    sheet.columns.forEach(column => {
      let maxLen = 15;
      column.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.value) {
          const valString = cell.value.toString();
          // Skip title & KPI rows
          if (cell.row <= 6) return;
          if (valString.length > maxLen) {
            maxLen = valString.length;
          }
        }
      });
      column.width = Math.min(maxLen + 4, 45); // Set width with margin, cap at 45
    });

    // 10. Write & send the Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="AI_Tahlil_Hisoboti.xlsx"');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const Customer = require('../models/Customer');
const Payment = require('../models/Payment');

exports.exportFullDatabaseExcel = async (req, res) => {
  try {
    const workbook = new exceljs.Workbook();
    workbook.creator = 'OBOI CRM';
    workbook.created = new Date();

    // 1. PRODUCTS
    const productsSheet = workbook.addWorksheet('Maxsulotlar');
    productsSheet.columns = [
      { header: 'ID', key: '_id', width: 25 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Artikul', key: 'artikul', width: 20 },
      { header: 'Material', key: 'material', width: 15 },
      { header: 'Qoldiq (rulon)', key: 'quantity', width: 15 },
      { header: 'Sotilgan', key: 'soldQuantity', width: 15 },
      { header: 'Sotuv Narxi (so\'m)', key: 'pricePerRoll', width: 20 },
      { header: 'Tan Narxi (so\'m)', key: 'costPerRoll', width: 20 },
      { header: 'Yaratilgan Sana', key: 'createdAt', width: 20 }
    ];
    // header styling
    productsSheet.getRow(1).font = { bold: true };
    productsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const products = await Product.find().lean();
    products.forEach(p => {
      productsSheet.addRow({
        _id: p._id.toString(),
        brand: p.brand || '',
        artikul: p.artikul || '',
        material: p.material || '',
        quantity: p.quantity || 0,
        soldQuantity: p.soldQuantity || 0,
        pricePerRoll: p.pricePerRoll || 0,
        costPerRoll: p.costPerRoll || 0,
        createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : ''
      });
    });

    // 2. CUSTOMERS
    const customersSheet = workbook.addWorksheet('Mijozlar');
    customersSheet.columns = [
      { header: 'ID', key: '_id', width: 25 },
      { header: 'Ismi/Nomi', key: 'name', width: 30 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Umumiy Xarid', key: 'totalPurchased', width: 20 },
      { header: 'Joriy Qarz', key: 'totalDebt', width: 20 },
      { header: 'Keshbek', key: 'cashbackBalance', width: 15 },
      { header: 'Turi', key: 'type', width: 15 },
      { header: 'Yaratilgan Sana', key: 'createdAt', width: 20 }
    ];
    customersSheet.getRow(1).font = { bold: true };
    customersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const customers = await Customer.find().lean();
    customers.forEach(c => {
      customersSheet.addRow({
        _id: c._id.toString(),
        name: c.name || '',
        phone: c.phone || '',
        totalPurchased: c.totalPurchased || 0,
        totalDebt: c.totalDebt || 0,
        cashbackBalance: c.cashbackBalance || 0,
        type: c.type || '',
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('ru-RU') : ''
      });
    });

    // 3. ORDERS
    const ordersSheet = workbook.addWorksheet('Buyurtmalar');
    ordersSheet.columns = [
      { header: 'Order ID', key: 'orderNumber', width: 20 },
      { header: 'Mijoz ID', key: 'customer', width: 25 },
      { header: 'Sklad ID', key: 'warehouse', width: 25 },
      { header: 'Turi', key: 'type', width: 15 },
      { header: 'To\'lov Turi', key: 'paymentType', width: 15 },
      { header: 'Umumiy Summa', key: 'totalAmount', width: 20 },
      { header: 'To\'langan', key: 'paidAmount', width: 20 },
      { header: 'Qarz', key: 'debtAmount', width: 20 },
      { header: 'Foyda', key: 'totalProfit', width: 20 },
      { header: 'Sana', key: 'createdAt', width: 20 }
    ];
    ordersSheet.getRow(1).font = { bold: true };
    ordersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const orders = await Order.find().lean();
    orders.forEach(o => {
      ordersSheet.addRow({
        orderNumber: o.orderNumber || o._id.toString(),
        customer: o.customer ? o.customer.toString() : '',
        warehouse: o.warehouse ? o.warehouse.toString() : '',
        type: o.type || '',
        paymentType: o.paymentType || '',
        totalAmount: o.totalAmount || 0,
        paidAmount: o.paidAmount || 0,
        debtAmount: o.debtAmount || 0,
        totalProfit: o.totalProfit || 0,
        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleDateString('ru-RU') : ''
      });
    });

    // 4. PAYMENTS
    const paymentsSheet = workbook.addWorksheet('To\'lovlar');
    paymentsSheet.columns = [
      { header: 'Payment ID', key: '_id', width: 25 },
      { header: 'Mijoz ID', key: 'customer', width: 25 },
      { header: 'Order ID', key: 'order', width: 25 },
      { header: 'Summa', key: 'amount', width: 20 },
      { header: 'Usul', key: 'method', width: 15 },
      { header: 'Izoh', key: 'note', width: 30 },
      { header: 'Sana', key: 'createdAt', width: 20 }
    ];
    paymentsSheet.getRow(1).font = { bold: true };
    paymentsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const payments = await Payment.find().lean();
    payments.forEach(p => {
      paymentsSheet.addRow({
        _id: p._id.toString(),
        customer: p.customer ? p.customer.toString() : '',
        order: p.order ? p.order.toString() : '',
        amount: p.amount || 0,
        method: p.method || '',
        note: p.note || '',
        createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : ''
      });
    });

    // Auto-filter for all sheets
    [productsSheet, customersSheet, ordersSheet, paymentsSheet].forEach(sheet => {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columnCount }
      };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `Oboi_Backup_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export Backup Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportFullDatabaseJson = async (req, res) => {
  try {
    const products = await Product.find().lean();
    const customers = await Customer.find().lean();
    const orders = await Order.find().lean();
    const payments = await Payment.find().lean();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        products,
        customers,
        orders,
        payments
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="Oboi_Backup_${new Date().toISOString().split('T')[0]}.json"`);
    
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Export JSON Backup Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
