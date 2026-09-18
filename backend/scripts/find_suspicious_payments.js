require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/oboi');
  
  // Bugun yoki kecha kiritilgan, summasi juda kichik to'lovlar (masalan < 100,000)
  const d = new Date();
  d.setDate(d.getDate() - 3); // last 3 days
  
  const payments = await Payment.find({
    amount: { $lt: 100000 },
    createdAt: { $gte: d }
  }).populate('customer', 'name totalDebt').lean();

  console.log(`Topildi: ${payments.length} ta shubhali to'lovlar (oxirgi 3 kunda 100,000 so'mdan kam kiritilgan)`);
  
  payments.forEach(p => {
    console.log(`- To'lov ID: ${p._id} | Mijoz: ${p.customer?.name} | Summa: ${p.amount} so'm | Kiritilgan sana: ${p.createdAt.toLocaleString('uz-UZ')}`);
  });
  
  process.exit(0);
}
run();
