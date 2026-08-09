require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function fixPrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const products = await Product.find({});
    let updatedCount = 0;

    for (let p of products) {
      let changed = false;
      
      const pricePerRoll = p.pricePerRoll || 0;
      const wholesalePrice = p.wholesalePrice || 0;
      const pricePerRollUsd = p.pricePerRollUsd || 0;
      const wholesalePriceUsd = p.wholesalePriceUsd || 0;

      if (pricePerRoll > 0 && wholesalePrice > 0 && pricePerRoll < wholesalePrice) {
        p.pricePerRoll = wholesalePrice;
        p.wholesalePrice = pricePerRoll;
        changed = true;
      }

      if (pricePerRollUsd > 0 && wholesalePriceUsd > 0 && pricePerRollUsd < wholesalePriceUsd) {
        p.pricePerRollUsd = wholesalePriceUsd;
        p.wholesalePriceUsd = pricePerRollUsd;
        changed = true;
      }

      if (changed) {
        if (p.rollLength) {
          p.pricePerMeter = p.pricePerRoll / p.rollLength;
        }
        if (p.rollsPerBox) {
          p.pricePerBox = p.pricePerRoll * p.rollsPerBox;
        }

        await p.save();
        console.log(`Updated product ${p.artikul} - Swapped prices`);
        updatedCount++;
      }
    }

    console.log(`Finished fixing prices. Updated ${updatedCount} products.`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixPrices();
