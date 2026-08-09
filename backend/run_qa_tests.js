const mongoose = require('mongoose');
require('dotenv').config();

const Warehouse = require('./models/Warehouse');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const RENDER_URL = "https://oboi.onrender.com";

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);

  let warehouses = await Warehouse.find({});
  const whA = warehouses[0];
  let whB = warehouses[1];

  let dummyWhCreated = false;
  if (!whB) {
    whB = await Warehouse.create({ name: 'TEST FILIAL B', location: 'Test', capacity: 100, isActive: true });
    dummyWhCreated = true;
  }

  // Cleanup stuck test users
  await User.deleteMany({ username: { $in: ['tempsuper123', 'tempseller123'] } });

  // Create temporary users
  const tempPass = 'Test@12345';
  const hashedPass = await bcrypt.hash(tempPass, 10);
  
  const tempSuperAdmin = await User.create({
    name: 'Temp Super', username: 'tempsuper123', password: hashedPass, role: 'superadmin', isActive: true
  });
  
  const tempSeller = await User.create({
    name: 'Temp Seller', username: 'tempseller123', password: hashedPass, role: 'cashier', warehouse: whB._id, isActive: true
  });

  // Login via API to get valid tokens from Render server
  const r1 = await fetch(`${RENDER_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tempsuper123', password: tempPass })
  });
  const saData = await r1.json();
  const saToken = saData.token;

  const r2 = await fetch(`${RENDER_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tempseller123', password: tempPass })
  });
  const sellerData = await r2.json();
  const sellerBToken = sellerData.token;

  let productsA = await Product.find({ warehouse: whA._id, isActive: true, quantity: { $gte: 2 } }).limit(1);
  let productA = productsA[0];

  let customer = await Customer.findOne({});

  console.log(`\n=== TAYYORLOV ===`);
  console.log(`Render Token olindi: ${!!saToken}`);

  console.log(`\n=== TEST 1.1: Filial izolyatsiyasi ===`);
  const res11 = await fetch(`${RENDER_URL}/api/products?warehouse=${whA._id}`, {
    headers: { 'Authorization': `Bearer ${sellerBToken}` }
  });
  console.log(`REQUEST: GET /api/products?warehouse=${whA._id} (Seller B tokeni bilan)`);
  console.log(`RESPONSE:\nStatus: ${res11.status}\nBody:`, await res11.json());

  console.log(`\n=== TEST 1.2: Expired Token ===`);
  const res12 = await fetch(`${RENDER_URL}/api/products`, {
    headers: { 'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_token_data.signature_invalid` }
  });
  console.log(`RESPONSE:\nStatus: ${res12.status}\nBody:`, await res12.json());

  console.log(`\n=== TEST 2.2: RACE CONDITION ===`);
  const qtyToBuy = productA.quantity;
  const orderBody = {
    warehouse: whA._id,
    customer: customer._id,
    items: [{ product: productA._id, quantity: qtyToBuy, unit: 'rulon', unitPrice: productA.pricePerRoll }],
    paymentType: "naqd",
    totalAmount: productA.pricePerRoll * qtyToBuy,
    paidAmount: productA.pricePerRoll * qtyToBuy,
    debtAmount: 0,
    status: 'pending' // pending qilmaylik, API'ga bog'liq bo'lsa
  };

  const [rr1, rr2] = await Promise.all([
    fetch(`${RENDER_URL}/api/orders`, { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+saToken}, body:JSON.stringify(orderBody) }),
    fetch(`${RENDER_URL}/api/orders`, { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+saToken}, body:JSON.stringify(orderBody) })
  ]);
  
  const b1 = await rr1.json();
  const b2 = await rr2.json();
  console.log("1-so'rov:\nStatus:", rr1.status, "\nBody:", b1);
  console.log("2-so'rov:\nStatus:", rr2.status, "\nBody:", b2);

  const updatedProdA = await Product.findById(productA._id);
  console.log(`MONGODB TEKSHIRUV: Hozirgi quantity: ${updatedProdA.quantity}`);

  console.log(`\n=== TEST 8.1: RATE LIMIT ===`);
  const rlResults = [];
  for(let i=0; i<110; i++) {
    rlResults.push(fetch(`${RENDER_URL}/api/products?limit=1`, { headers: { "Authorization": "Bearer " + saToken } }));
  }
  const rlResps = await Promise.all(rlResults);
  const rlStatus = rlResps.map(r => r.status);
  console.log(`RESPONSE: 429 bo'lgan so'rovlar: ${rlStatus.filter(s => s === 429).length} ta`);

  console.log(`\n=== TEST 8.2: NoSQL Injection ===`);
  const nosqlRes = await fetch(`${RENDER_URL}/api/products?search[$gt]=`, {
    headers: { "Authorization": "Bearer " + saToken }
  });
  console.log(`RESPONSE:\nStatus: ${nosqlRes.status}`);

  // Cleanup
  await User.findByIdAndDelete(tempSuperAdmin._id);
  await User.findByIdAndDelete(tempSeller._id);
  if (dummyWhCreated) await Warehouse.findByIdAndDelete(whB._id);
  
  process.exit(0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
