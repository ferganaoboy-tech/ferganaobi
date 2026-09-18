require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oboi');
  
  const d = new Date();
  d.setDate(d.getDate() - 3);
  
  const payments = await Payment.find({
    amount: { $lt: 100000 },
    createdAt: { $gte: d }
  }).populate('customer', 'name').lean();

  console.log(`Topildi: ${payments.length} ta shubhali to'lovlar oxirgi 3 kunda ( < 100,000 )`);
  
  payments.forEach(p => {
    console.log(`- To'lov ID: ${p._id} | Mijoz: ${p.customer?.name} | Summa: ${p.amount} UZS | Kiritilgan sana: ${p.createdAt.toLocaleString('uz-UZ')}`);
  });
  
  process.exit(0);
}
run();
