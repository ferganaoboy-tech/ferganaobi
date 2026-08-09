require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wallpaper-crm');
    console.log('Connected to DB');

    const result = await Product.updateMany(
      { $or: [{ category: { $exists: false } }, { unit: { $exists: false } }] },
      { $set: { category: 'oboi', unit: 'rulon' } }
    );
    console.log(`Migration successful. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
