const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const { logAction } = require('../utils/logger');
const { cloudinary } = require('../middleware/upload');

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ usdExchangeRate: 12500 });
    }

    let dbStats = null;
    if (mongoose.connection && mongoose.connection.db) {
      try {
        dbStats = await mongoose.connection.db.stats();
      } catch(err) {
        console.error("Error fetching db stats", err);
      }
    }

    let cloudinaryStats = null;
    try {
      if (cloudinary.config().cloud_name) {
        cloudinaryStats = await cloudinary.api.usage();
      }
    } catch(err) {
      console.error("Error fetching cloudinary stats", err);
    }

    res.status(200).json({ success: true, data: settings, dbStats, cloudinaryStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { usdExchangeRate, cartFields, features } = req.body;
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({ 
        usdExchangeRate: usdExchangeRate || 12500,
        cartFields: cartFields || undefined,
        features: features || undefined
      });
    } else {
      // cartFields — faqat ko'rsatilgan maydonlarni yangilash (merge)
      if (cartFields !== undefined) {
        settings.cartFields = { ...settings.cartFields.toObject?.() || settings.cartFields, ...cartFields };
      }

      // features — feature flag'larni yangilash (merge)
      if (features !== undefined) {
        const currentFeatures = settings.features?.toObject?.() || settings.features || {};
        settings.features = { ...currentFeatures, ...features };
      }

      // usdExchangeRate — barcha mahsulot narxlarini qayta hisoblash
      if (usdExchangeRate && settings.usdExchangeRate !== usdExchangeRate) {
        settings.usdExchangeRate = usdExchangeRate;
        await settings.save();

        // DYNAMIC UPDATE: Barcha mahsulotlar UZS narxi qayta hisoblanadi
        const products = await Product.find({ isActive: true });
        for (let product of products) {
          let updated = false;
          if (product.pricePerRollUsd) {
            product.pricePerRoll = Math.round(product.pricePerRollUsd * usdExchangeRate);
            updated = true;
          }
          if (product.wholesalePriceUsd) {
            product.wholesalePrice = Math.round(product.wholesalePriceUsd * usdExchangeRate);
            updated = true;
          }
          if (updated) {
            await product.save();
          }
        }
      } else {
        await settings.save();
      }
    }

    // Loglash
    const logDetails = [];
    if (usdExchangeRate) logDetails.push(`Kurs: 1 USD = ${usdExchangeRate} so'm`);
    if (features?.shiftEnabled !== undefined) logDetails.push(`Smena tizimi: ${features.shiftEnabled ? 'YOQILDI' : 'O\'CHIRILDI'}`);
    await logAction(req, 'UPDATE', 'Settings', settings._id, logDetails.join('. ') || 'Sozlamalar yangilandi');

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getDbStats = async (req, res) => {
  try {
    const collections = mongoose.connection.collections;
    const stats = [];

    for (const key in collections) {
      const collection = collections[key];
      const count = await collection.countDocuments();
      let size = 0;
      try {
        const [stats] = await mongoose.connection.db.collection(key).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
        if (stats && stats.storageStats) {
          size = stats.storageStats.size;
        }
      } catch (e) {
        // Fallback for environments where $collStats is restricted
        try {
          const stats = await collection.stats();
          size = stats.size || 0;
        } catch(err) {
          console.error(`Stats error for ${key}:`, err.message);
        }
      }

      stats.push({
        name: key,
        count,
        size
      });
    }

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearDomain = async (req, res) => {
  try {
    const { action, password } = req.body;
    
    if (!action || !password) {
      return res.status(400).json({ success: false, message: "Barcha maydonlarni to'ldiring." });
    }

    // Parolni tekshirish
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Noto'g'ri parol kiritildi." });
    }

    const AuditLog = require('../models/AuditLog');
    
    if (action === 'transactions') {
      const { dateTo, employeeId } = req.body;
      let query = {};
      
      if (dateTo) {
        query.createdAt = { $lte: new Date(dateTo) };
      }
      if (employeeId) {
        query.seller = employeeId;
      }

      const isPartial = Object.keys(query).length > 0;

      if (isPartial) {
        // QISMIY TOZALASH
        const Order = require('../models/Order');
        const Payment = require('../models/Payment');
        const Return = require('../models/Return');
        const Transfer = require('../models/Transfer');
        const Shift = require('../models/Shift');
        const Product = require('../models/Product');
        const Customer = require('../models/Customer');

        // 1. Qoldiqni to'g'irlash uchun avval o'chiriladigan buyurtmalarni topamiz
        const ordersToDelete = await Order.find(query).lean();
        
        // Mahsulotlardan ayirish
        for (let order of ordersToDelete) {
          if (order.items && order.items.length > 0) {
            for (let item of order.items) {
              if (item.product) {
                await Product.findByIdAndUpdate(item.product, {
                  $inc: { soldQuantity: -item.quantity }
                });
              }
            }
          }
        }

        // 2. Ma'lumotlarni o'chirish
        await Order.deleteMany(query);
        await Payment.deleteMany(employeeId ? { createdBy: employeeId, ...query } : query);
        await Return.deleteMany(employeeId ? { user: employeeId, ...query } : query);
        await Transfer.deleteMany(employeeId ? { user: employeeId, ...query } : query);
        if (!employeeId) {
          await Shift.deleteMany(query);
        }

        // 3. Qarzni orqa fonda qayta hisoblash (Faqatgina Orders va Payments ni to'liq hisoblab chiqish)
        const recalculateDebts = async () => {
          try {
            const customers = await Customer.find({ isActive: true });
            for (let customer of customers) {
              const orders = await Order.find({ customer: customer._id, status: { $in: ['confirmed', 'delivered'] } });
              let realTotalDebt = 0;
              let realTotalPurchased = 0;
              for (let o of orders) {
                realTotalDebt += Math.max(0, o.debtAmount || 0);
                realTotalPurchased += o.totalAmount || 0;
              }
              if (customer.totalDebt !== realTotalDebt || customer.totalPurchased !== realTotalPurchased) {
                await Customer.findByIdAndUpdate(customer._id, {
                  $set: { totalDebt: Math.max(0, realTotalDebt), totalPurchased: realTotalPurchased }
                });
              }
            }
          } catch(e) {
            console.error('Qayta hisoblashda xatolik:', e);
          }
        };
        // Orqa fonda ishga tushiramiz
        recalculateDebts();

        await AuditLog.create({
          userName: req.user.username,
          action: 'SYSTEM',
          entity: 'Database',
          details: `Qismiy savdo tozalash. (Sana: ${dateTo || 'Hammasi'}, Xodim: ${employeeId || 'Hammasi'})`,
          ip: req.ip
        });

      } else {
        // TO'LIQ TOZALASH
        await mongoose.connection.collections['orders']?.deleteMany({});
        await mongoose.connection.collections['payments']?.deleteMany({});
        await mongoose.connection.collections['returns']?.deleteMany({});
        await mongoose.connection.collections['transfers']?.deleteMany({});
        await mongoose.connection.collections['shifts']?.deleteMany({});
        
        await mongoose.connection.collections['customers']?.updateMany({}, {
          $set: { totalDebt: 0, totalPurchased: 0, cashbackBalance: 0 }
        });
  
        await mongoose.connection.collections['products']?.updateMany({}, {
          $set: { soldQuantity: 0 }
        });
  
        await AuditLog.create({
          userName: req.user.username,
          action: 'SYSTEM',
          entity: 'Database',
          details: 'Barcha savdo va moliyaviy tarix toliq tozalandi.',
          ip: req.ip
        });
      }

      try {
        const { clearDashboardCache } = require('./orderController');
        clearDashboardCache();
      } catch (e) {}

      return res.status(200).json({ success: true, message: isPartial ? "Tanlangan savdo va moliya tarixi muvaffaqiyatli tozalandi!" : "Savdo va moliyaviy tarix to'liq tozalandi!" });
    }

    if (action === 'customers') {
      await mongoose.connection.collections['customers']?.deleteMany({});
      
      await AuditLog.create({
        userName: req.user.username,
        action: 'SYSTEM',
        entity: 'Database',
        details: 'Mijozlar bazasi tozalandi.',
        ip: req.ip
      });

      return res.status(200).json({ success: true, message: "Mijozlar bazasi muvaffaqiyatli tozalandi!" });
    }

    if (action === 'full') {
      const collections = mongoose.connection.collections;
      const PROTECTED_COLLECTIONS = new Set(['auditlogs', 'telegramsubscribers', 'users']);
      
      for (const key in collections) {
        if (!PROTECTED_COLLECTIONS.has(key)) {
          await collections[key].deleteMany({});
        }
      }

      // Users: Faqat superadminlarni qoldiramiz
      await User.deleteMany({ role: { $ne: 'superadmin' } });

      await AuditLog.create({
        userName: req.user.username,
        action: 'SYSTEM',
        entity: 'Database',
        details: 'Tizim to\'liq zavod sozlamalariga qaytarildi.',
        ip: req.ip
      });

      try {
        const { clearDashboardCache } = require('./orderController');
        clearDashboardCache();
      } catch (e) {}

      return res.status(200).json({ success: true, message: "Tizim to'liq tozalandi!" });
    }

    res.status(400).json({ success: false, message: "Noto'g'ri harakat tanlandi." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
