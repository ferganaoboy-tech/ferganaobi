const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');

// @desc    Get all warehouses with stats
// @route   GET /api/warehouses
// @access  Public
exports.getAllWarehouses = async (req, res) => {
  try {
    const { basic } = req.query;
    const query = { isActive: true };

    // Boshqa filialga o'tkazish uchun faqat nomlari kerak bo'lganda (barcha filiallarni ko'rsatish)
    if (basic === 'true') {
      const warehouses = await Warehouse.find(query).select('name color location');
      return res.status(200).json({ success: true, data: warehouses });
    }

    // Odatiy holat: oddiy xodimlar faqat o'ziga biriktirilgan skladni ko'radi
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin' && req.user.warehouse) {
      query._id = req.user.warehouse;
    }
    const warehouses = await Warehouse.find(query);
    
    // Calculate stats for each warehouse
    const warehousesWithStats = await Promise.all(
      warehouses.map(async (warehouse) => {
        const products = await Product.find({ warehouse: warehouse._id, isActive: true });
        
        const totalRolls = products.reduce((sum, p) => sum + p.quantity, 0);
        const totalProducts = products.length;
        const totalValue = products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
        const totalRetailValue = products.reduce((sum, p) => sum + (p.pricePerRoll * p.quantity), 0);
        const expectedProfit = totalRetailValue - totalValue;
        const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;
        
        // Categories breakdown by material
        const categories = products.reduce((acc, p) => {
          acc[p.material] = (acc[p.material] || 0) + p.quantity;
          return acc;
        }, {});

        return {
          ...warehouse.toObject(),
          stats: {
            totalRolls,
            totalProducts,
            totalValue,
            totalRetailValue,
            expectedProfit,
            lowStockCount,
            categories,
          }
        };
      })
    );

    res.status(200).json({ success: true, data: warehousesWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create warehouse
// @route   POST /api/warehouses
// @access  Public
exports.createWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.create(req.body);
    req.app.get('io').emit('warehouse:created', warehouse);
    res.status(201).json({ success: true, data: warehouse });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update warehouse
// @route   PUT /api/warehouses/:id
// @access  Public
exports.updateWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    req.app.get('io').emit('warehouse:updated', warehouse);
    res.status(200).json({ success: true, data: warehouse });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete warehouse (soft)
// @route   DELETE /api/warehouses/:id
// @access  Public
exports.deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id, 
      { isActive: false }, 
      { new: true }
    );
    
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    req.app.get('io').emit('warehouse:deleted', warehouse._id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
