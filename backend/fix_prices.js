require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Settings = require('./models/Settings');

async function fixMissingUsdCosts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/oboi-crm');
    console.log('MongoDB ga ulandi. Migratsiya boshlandi...');

    const settings = await Settings.findOne().lean();
    const usdRate = settings?.usdExchangeRate || 11800; // Asosiy fallback kurs

    // costPriceUsd mavjud bo'lmagan yoki 0 bo'lgan mahsulotlarni topamiz
    const productsToFix = await Product.find({
      $or: [
        { costPriceUsd: { $exists: false } },
        { costPriceUsd: null },
        { costPriceUsd: 0 }
      ],
      costPrice: { $gt: 0 } // Faqatgina so'mdagi tan narxi borlarni
    });

    console.log(`${productsToFix.length} ta mahsulot topildi. Yangilanmoqda...`);

    let updatedCount = 0;
    for (const product of productsToFix) {
      // So'mdagi tan narxni kursga bo'lib, dollardagi tan narxni yasaymiz
      const calculatedUsd = parseFloat((product.costPrice / usdRate).toFixed(2));
      
      product.costPriceUsd = calculatedUsd;
      
      // Xuddi shunday, agar optom/sotuv narxlarining USD varianti yo'q bo'lsa
      if (!product.wholesalePriceUsd && product.wholesalePrice) {
        product.wholesalePriceUsd = parseFloat((product.wholesalePrice / usdRate).toFixed(2));
      }
      if (!product.pricePerRollUsd && product.pricePerRoll) {
        product.pricePerRollUsd = parseFloat((product.pricePerRoll / usdRate).toFixed(2));
      }

      await product.save({ validateBeforeSave: false });
      updatedCount++;
    }

    console.log(`Migratsiya tugadi! ${updatedCount} ta mahsulotga USD narxlar yozildi.`);
    process.exit(0);
  } catch (error) {
    console.error('Xatolik yuz berdi:', error);
    process.exit(1);
  }
}

fixMissingUsdCosts();
