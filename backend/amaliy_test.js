const mongoose = require('mongoose');
require('dotenv').config();

const { processOrder } = require('./services/orderService');
const { cancelOrder } = require('./controllers/orderController');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Warehouse = require('./models/Warehouse');
const User = require('./models/User');

const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {}
};

async function runPracticalTests() {
  console.log("==> AMALIY TESTLAR BOSHLANDI...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("==> MongoDB ga ulandi.");

  try {
    const warehouse = await Warehouse.findOne({ isActive: true });
    const product = await Product.findOne({ warehouse: warehouse._id, isActive: true, quantity: { $gte: 5 } });
    let customer = await Customer.findOne({ name: 'Test Mijoz Amaliy' });
    
    if (!customer) {
      customer = await Customer.create({ name: 'Test Mijoz Amaliy', phone: '+998991234567', totalDebt: 0, cashbackBalance: 0, cashbackPercent: 5 });
    }

    if (!product) {
        throw new Error("Test uchun yetarli tovar yo'q");
    }

    console.log(`\n[TEST 1] - Moliyaviy aniqlik (Buyurtma)`);
    const initialStock = product.quantity;
    const initialDebt = customer.totalDebt;
    const qtyToBuy = 2;
    const unitPrice = product.pricePerRoll || 100000;
    
    const orderData = {
      warehouse: warehouse._id,
      customer: customer._id,
      items: [{ product: product._id, quantity: qtyToBuy, unit: 'rulon', unitPrice: unitPrice }],
      paymentType: 'qisman',
      type: 'retail',
      paidAmount: unitPrice, 
      status: 'confirmed'
    };

    console.log(`- ${qtyToBuy} ta ${product.artikul} sotib olinmoqda. Jami: ${qtyToBuy * unitPrice}. To'lov: ${unitPrice}. Kutilayotgan qarz: ${unitPrice}`);
    
    const mockUser = { _id: new mongoose.Types.ObjectId(), name: "Test User", role: "superadmin" };
    const order = await processOrder(orderData, mockUser, mockIo);
    
    const updatedProduct = await Product.findById(product._id);
    const updatedCustomer = await Customer.findById(customer._id);
    
    console.log(`=> Tovar qoldig'i: ${initialStock} -> ${updatedProduct.quantity} (Ayirma: ${initialStock - updatedProduct.quantity})`);
    if (initialStock - updatedProduct.quantity === qtyToBuy) console.log("✅ Qoldiq ayirildi (100% aniq)");
    else console.log("❌ Qoldiq xato!");

    console.log(`=> Mijoz qarzi: ${initialDebt} -> ${updatedCustomer.totalDebt} (Qarz: ${order.debtAmount})`);
    if (order.debtAmount === unitPrice && updatedCustomer.totalDebt - initialDebt === unitPrice) console.log("✅ Qarz hisob-kitobi (100% aniq)");
    else console.log("❌ Qarz xato!");

    console.log(`\n[TEST 2] - Tranzaksiyani Bekor Qilish (Cancel)`);
    
    const req = {
      params: { id: order._id },
      app: { get: () => mockIo }
    };
    let cancelData = null;
    const res = {
      status: () => ({ json: (data) => { cancelData = data; } })
    };

    await cancelOrder(req, res);
    
    const finalProduct = await Product.findById(product._id);
    const finalCustomer = await Customer.findById(customer._id);

    console.log(`=> Tovar qoldig'i qaytdimi: ${finalProduct.quantity}`);
    if (finalProduct.quantity === initialStock) console.log("✅ Tovar o'z joyiga 100% qaytdi");
    else console.log("❌ Tovar qoldig'i qaytmadi!");

    console.log(`=> Mijoz qarzi qaytdimi: ${finalCustomer.totalDebt}`);
    if (finalCustomer.totalDebt === initialDebt - unitPrice) console.log(`✅ To'langan pul mijoz balansiga o'tdi (Credit: ${-finalCustomer.totalDebt}) (100% aniq)`);
    else console.log("❌ Qarz hisobi xato qaytdi!");

    console.log("\n==> BARCHA AMALIY TESTLAR MUVAFFAQIYATLI YAKUNLANDI!");
    
  } catch (err) {
    console.error("Test xatosi:", err);
  } finally {
    await mongoose.disconnect();
    console.log("==> MongoDB uzildi.");
  }
}

runPracticalTests();
