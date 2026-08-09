const Customer = require('../models/Customer');
const { logAction } = require('../utils/logger');
const Order = require('../models/Order');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Public
exports.getCustomers = async (req, res) => {
  try {
    const { type, region, hasDebt, search, page = 1, limit = 20 } = req.query;

    const query = { isActive: true };

    if (type && type !== 'Barchasi') query.type = type;
    if (region) query.region = region;
    if (hasDebt === 'true') query.totalDebt = { $gt: 0 };
    
    if (search) {
      query.$text = { $search: search };
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await Customer.countDocuments(query);

    // Optimize total debt sum calculation using MongoDB Aggregation to avoid Memory Crash
    const debtAgg = await Customer.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalDebt' } } }
    ]);
    const totalDebtSum = debtAgg.length > 0 ? debtAgg[0].total : 0;

    let sortObj = { createdAt: -1 };
    if (search) {
      sortObj = { score: { $meta: 'textScore' } };
    }

    const customers = await Customer.find(query)
      .sort(sortObj)
      .skip(startIndex)
      .limit(Number(limit))
      .lean(); // Add lean() for performance

    // Optimize N+1 Query Problem using a single Order aggregation
    const customerIds = customers.map(c => c._id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderStats = await Order.aggregate([
      { $match: { customer: { $in: customerIds } } },
      { $group: {
          _id: '$customer',
          lastOrderDate: { $max: '$createdAt' },
          recentOrderCount: {
            $sum: { $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, 1, 0] }
          }
        }
      }
    ]);

    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat._id.toString()] = stat;
    });

    const customersWithStats = customers.map(c => ({
      ...c,
      recentOrderCount: statsMap[c._id.toString()]?.recentOrderCount || 0,
      lastOrderDate: statsMap[c._id.toString()]?.lastOrderDate || null
    }));

    res.status(200).json({
      success: true,
      data: customersWithStats,
      totalDebtSum,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Public
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer || !customer.isActive) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const recentOrders = await Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('warehouse', 'name');

    res.status(200).json({ 
      success: true, 
      data: {
        ...customer.toObject(),
        recentOrders
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Public
exports.createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    await logAction(req, 'CREATE', 'Customer', customer._id, `Yangi mijoz qo'shildi: ${customer.name}`);
    req.app.get('io').emit('customer:created', customer);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
        return res.status(400).json({ success: false, message: 'Bu telefon raqami band qilingan' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Public
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!customer || !customer.isActive) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    req.app.get('io').emit('customer:updated', customer);
    await logAction(req, 'UPDATE', 'Customer', customer._id, `Mijoz ma'lumotlari yangilandi: ${customer.name}`);
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
        return res.status(400).json({ success: false, message: 'Bu telefon raqami band qilingan' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Public
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id, 
      { isActive: false }, 
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    req.app.get('io').emit('customer:deleted', req.params.id);
    await logAction(req, 'DELETE', 'Customer', customer._id, `Mijoz o'chirildi: ${customer.name}`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get debtors
// @route   GET /api/customers/debtors
// @access  Public
exports.getDebtors = async (req, res) => {
  try {
    const debtors = await Customer.find({ isActive: true, totalDebt: { $gt: 0 } })
      .sort({ totalDebt: -1 })
      .lean(); // Add lean() for performance

    const debtorIds = debtors.map(c => c._id);

    // Optimize N+1 Query Problem using a single Order aggregation for debtors
    const orderStats = await Order.aggregate([
      { $match: { customer: { $in: debtorIds } } },
      { $group: {
          _id: '$customer',
          lastOrderDate: { $max: '$createdAt' },
          unpaidOrdersCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $gt: ['$debtAmount', 0] },
                  { $ne: ['$status', 'cancelled'] }
                ]}, 1, 0
              ]
            }
          }
        }
      }
    ]);

    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat._id.toString()] = stat;
    });

    const debtorsWithStats = debtors.map(c => ({
      ...c,
      lastOrderDate: statsMap[c._id.toString()]?.lastOrderDate || null,
      unpaidOrdersCount: statsMap[c._id.toString()]?.unpaidOrdersCount || 0
    }));

    res.status(200).json({ success: true, data: debtorsWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Recalculate all customer debts from actual orders (fix corrupted data)
// @route   POST /api/customers/recalculate-debts
// @access  Public
exports.recalculateAllDebts = async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true });
    let fixed = 0;

    for (let customer of customers) {
      // Sum all confirmed/delivered orders' debtAmount
      const orders = await Order.find({ 
        customer: customer._id, 
        status: { $in: ['confirmed', 'delivered'] }
      });

      let realTotalDebt = 0;
      let realTotalPurchased = 0;

      for (let order of orders) {
        realTotalDebt += Math.max(0, order.debtAmount || 0);
        realTotalPurchased += order.totalAmount || 0;
      }

      // Subtract all confirmed payments
      const Payment = require('../models/Payment');
      const payments = await Payment.find({ customer: customer._id });
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Real debt = sum of order debts (already reflects payments via order.debtAmount)
      if (customer.totalDebt !== realTotalDebt || customer.totalPurchased !== realTotalPurchased) {
        await Customer.findByIdAndUpdate(customer._id, {
          $set: { 
            totalDebt: Math.max(0, realTotalDebt),
            totalPurchased: realTotalPurchased
          }
        });
        fixed++;
      }
    }

    res.status(200).json({ success: true, message: `${fixed} ta mijozning qarzi qayta hisoblandi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
