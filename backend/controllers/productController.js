const Product = require('../models/Product');
const { logAction } = require('../utils/logger');
const Order = require('../models/Order');
const Transfer = require('../models/Transfer');
const { cloudinary } = require('../middleware/upload');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { 
      warehouse, brand, polka, search, category,
      lowStock, minPrice, maxPrice, page = 1, limit = 20, 
      sortBy = 'createdAt', order = 'desc' 
    } = req.query;

    const query = { isActive: true };

    if (warehouse && warehouse !== 'all') {
      query.warehouse = typeof warehouse === 'string' ? warehouse : undefined;
    } else if (warehouse !== 'all' && req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      query.warehouse = req.user.warehouse;
    }
    if (brand && typeof brand === 'string') query.brand = brand;
    if (category && typeof category === 'string') query.category = category;
    if (polka && typeof polka === 'string') query.polka = { $regex: polka, $options: 'i' };
    if (lowStock === 'true') {
      // ✅ FIX: $expr ni to'g'ridan-to'g'ri o'rniga $and array bilan birlashtirish
      // Agar keyinchalik deadStock ham qo'shilsa, $and ga push qilinadi
      const lowStockExpr = { $lte: ['$quantity', { $ifNull: ['$minStock', 4] }] };
      if (query.$expr) {
        query.$expr = { $and: [query.$expr, lowStockExpr] };
      } else {
        query.$expr = lowStockExpr;
      }
    }
    if (req.query.deadStock === 'true') {
      query.soldQuantity = { $in: [0, null] };
      const deadStockExpr = { $gt: ['$quantity', { $ifNull: ['$minStock', 4] }] };
      // ✅ FIX: Mavjud $expr bilan $and orqali birlashtiramiz (overwrite emas)
      if (query.$expr) {
        query.$expr = { $and: [query.$expr, deadStockExpr] };
      } else {
        query.$expr = deadStockExpr;
      }
    }
    
    if (search) {
      const searchTerms = search.split(',').map(s => s.trim()).filter(Boolean);
      const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');

      if (searchTerms.length > 1) {
        const regexes = searchTerms.map(term => new RegExp(escapeRegex(term), 'i'));
        query.$or = [
          { artikul: { $in: regexes } },
          { brand: { $in: regexes } },
          { collection: { $in: regexes } },
          { polka: { $in: regexes } }
        ];
      } else {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { artikul: searchRegex },
          { brand: searchRegex },
          { collection: searchRegex },
          { polka: searchRegex }
        ];
      }
    }

    if (minPrice || maxPrice) {
      query.pricePerRoll = {};
      if (minPrice) query.pricePerRoll.$gte = Number(minPrice);
      if (maxPrice) query.pricePerRoll.$lte = Number(maxPrice);
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    let sortObj = { [sortBy]: sortOrder };

    if (sortBy === 'popular' || sortBy === 'quantityAsc') {
      sortObj = { quantity: 1, soldQuantity: -1, createdAt: -1 };
    } else if (sortBy === 'unpopular' || sortBy === 'quantityDesc') {
      sortObj = { quantity: -1, soldQuantity: 1, createdAt: -1 };
    } else if (sortBy === 'createdAt') {
      sortObj = { createdAt: -1 };
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate('warehouse', 'name color')
      .sort(sortObj)
      .skip(startIndex)
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: products,
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

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('warehouse', 'name color location')
      .lean();

    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Public
exports.createProduct = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      if (req.body.warehouse !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: "Faqat o'zingizga biriktirilgan skladga mahsulot qo'shishingiz mumkin." });
      }
    }

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => ({
        url: file.path,
        publicId: file.filename
      }));
    }

    const productData = { ...req.body, images };
    
    const product = await Product.create(productData);
    
    // Fetch with populated warehouse for the socket event
    const populatedProduct = await Product.findById(product._id).populate('warehouse', 'name color');
    const whId = populatedProduct.warehouse._id || populatedProduct.warehouse;
    req.app.get('io').to(whId.toString()).emit('product:created', populatedProduct);

    await logAction(req, 'CREATE', 'Product', product._id, `Yangi maxsulot qo'shildi: ${product.brand || ''} (${product.artikul})`);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    // Delete uploaded images if validation fails
    if (req.files) {
      for (const file of req.files) {
        await cloudinary.uploader.destroy(file.filename);
      }
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Public
exports.updateProduct = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      if (req.body.warehouse && req.body.warehouse !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: "Mahsulotni boshqa skladga ko'chirishga ruxsatingiz yo'q." });
      }
    }

    let product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    if (req.user && req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      const pWarehouse = product.warehouse._id ? product.warehouse._id.toString() : product.warehouse.toString();
      if (pWarehouse !== req.user.warehouse.toString()) {
        return res.status(403).json({ success: false, message: 'Siz boshqa sklad mahsulotini tahrirlay olmaysiz.' });
      }
    }

    let images = [...product.images];
    
    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path,
        publicId: file.filename
      }));
      images = [...images, ...newImages];
    }

    // Handle deleted images (if passed as array of publicIds to delete)
    if (req.body.deletedImages) {
      const deletedImagesArray = Array.isArray(req.body.deletedImages) 
        ? req.body.deletedImages 
        : [req.body.deletedImages];
        
      for (const publicId of deletedImagesArray) {
        await cloudinary.uploader.destroy(publicId);
        images = images.filter(img => img.publicId !== publicId);
      }
    }

    const updateData = { ...req.body, images };

    // Compute derived fields BEFORE atomic update to avoid race conditions
    const width = updateData.width !== undefined ? updateData.width : product.width;
    const rollLength = updateData.rollLength !== undefined ? updateData.rollLength : product.rollLength;
    const pricePerRoll = updateData.pricePerRoll !== undefined ? updateData.pricePerRoll : product.pricePerRoll;
    const rollsPerBox = updateData.rollsPerBox !== undefined ? updateData.rollsPerBox : product.rollsPerBox;

    if (width && rollLength) {
       updateData.coverage = width * rollLength;
    }
    if (pricePerRoll) {
       if (rollLength) updateData.pricePerMeter = pricePerRoll / rollLength;
       if (rollsPerBox) updateData.pricePerBox = pricePerRoll * rollsPerBox;
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('warehouse', 'name color');

    const whId = product.warehouse._id || product.warehouse;
    req.app.get('io').to(whId.toString()).emit('product:updated', product);

    await logAction(req, 'UPDATE', 'Product', product._id, `Maxsulot yangilandi: ${product.brand || product.artikul}`);

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Public
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Soft delete qilinayotgani sababli Cloudinary-dagi rasmlarni o'chirmaymiz.
    // Ular o'tgan buyurtmalar (history) ko'rilganda kerak bo'ladi.
    
    // Soft delete
    product.isActive = false;
    await product.save();

    const whId = product.warehouse._id || product.warehouse;
    req.app.get('io').to(whId.toString()).emit('product:deleted', req.params.id);

    await logAction(req, 'DELETE', 'Product', product._id, `Maxsulot o'chirildi: ${product.brand || product.artikul}`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get product filters
// @route   GET /api/products/filters
// @access  Public
exports.getFilters = async (req, res) => {
  try {
    const materials = await Product.distinct('material', { isActive: true });
    const designs = await Product.distinct('design', { isActive: true });
    const polkas = await Product.distinct('polka', { isActive: true });
    const brands = await Product.distinct('brand', { isActive: true, brand: { $ne: null, $ne: '' } });

    res.status(200).json({ success: true, data: { materials, designs, polkas, brands } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/products/stats/dashboard
// @access  Public (protect middleware bor)
exports.getDashboardStats = async (req, res) => {
  try {
    // ─── 1. Warehouse bo'yicha aggregation (barcha produktni xotiraga yuklamasdan) ──
    const warehouseAgg = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$warehouse',
          totalProducts: { $sum: 1 },
          totalRolls:    { $sum: '$quantity' },
          totalValue:    { $sum: { $multiply: [{ $ifNull: ['$costPrice', 0] }, { $ifNull: ['$quantity', 0] }] } },
          totalRetailValue: { $sum: { $multiply: [{ $ifNull: ['$pricePerRoll', 0] }, { $ifNull: ['$quantity', 0] }] } },
          lowStockItems: {
            $push: {
              $cond: [
                { $lte: ['$quantity', { $ifNull: ['$minStock', 4] }] },
                {
                  _id:         '$_id',
                  brand:       '$brand',
                  artikul:     '$artikul',
                  quantity:    '$quantity',
                  minStock:    '$minStock',
                  rollLength:  '$rollLength'
                },
                '$$REMOVE'
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'warehouses',
          localField: '_id',
          foreignField: '_id',
          as: 'warehouseInfo'
        }
      },
      {
        $unwind: { path: '$warehouseInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id:          1,
          name:         { $ifNull: ['$warehouseInfo.name', "Noma'lum sklad"] },
          color:        '$warehouseInfo.color',
          totalProducts: 1,
          totalRolls:   1,
          totalValue:   1,
          totalRetailValue: 1,
          lowStockItems: 1
        }
      }
    ]);

    // Umumiy summalar
    const totalProducts = warehouseAgg.reduce((s, w) => s + w.totalProducts, 0);
    const totalRolls    = warehouseAgg.reduce((s, w) => s + w.totalRolls, 0);
    const totalValue    = warehouseAgg.reduce((s, w) => s + w.totalValue, 0);
    const totalRetailValue = warehouseAgg.reduce((s, w) => s + (w.totalRetailValue || 0), 0);
    const expectedProfit = totalRetailValue - totalValue;
    const lowStockItems = warehouseAgg.flatMap(w => 
      (w.lowStockItems || []).map(item => ({
        ...item,
        warehouse: { name: w.name, color: w.color }
      }))
    );

    // ─── 2. Transfer statistikasi — aggregation bilan (JS filter yo'q) ─────
    const transferAgg = await Transfer.aggregate([
      { $match: { status: { $in: ['pending', 'completed'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            warehouse: {
              $cond: [
                { $in: ['$status', ['pending']] },
                {
                  from: '$fromWarehouse',
                  to:   '$toWarehouse'
                },
                {
                  from: '$fromWarehouse',
                  to:   '$toWarehouse'
                }
              ]
            },
            status:       '$status',
            fromWarehouse: '$fromWarehouse',
            toWarehouse:   '$toWarehouse'
          },
          totalQty: { $sum: '$items.quantity' }
        }
      }
    ]);

    // Transfer statlarini warehouse ga bog'lash
    const pendingIn  = {};  // toWarehouse → qty
    const pendingOut = {};  // fromWarehouse → qty
    const doneIn     = {};
    const doneOut    = {};

    transferAgg.forEach(t => {
      const from = t._id.fromWarehouse?.toString();
      const to   = t._id.toWarehouse?.toString();
      if (t._id.status === 'pending') {
        if (from) pendingOut[from] = (pendingOut[from] || 0) + t.totalQty;
        if (to)   pendingIn[to]   = (pendingIn[to]   || 0) + t.totalQty;
      } else {
        if (from) doneOut[from] = (doneOut[from] || 0) + t.totalQty;
        if (to)   doneIn[to]   = (doneIn[to]   || 0) + t.totalQty;
      }
    });

    const warehouseStats = warehouseAgg.map(w => {
      const wid = w._id?.toString();
      return {
        ...w,
        pendingInQuantity:    pendingIn[wid]  || 0,
        pendingOutQuantity:   pendingOut[wid] || 0,
        totalReceivedQuantity: doneIn[wid]   || 0,
        totalSentQuantity:    doneOut[wid]   || 0,
      };
    });

    // ─── 3. Top 10 mahsulot — aggregation (sort + limit DB da) ─────────────
    const topProducts = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $project: {
          brand:       1,
          artikul:     1,
          quantity:    1,
          pricePerRoll: 1,
          value: { $multiply: ['$pricePerRoll', '$quantity'] }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 10 }
    ]);

    // ─── 4. Joriy oy savdolari ────────────────────────────────────────────
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySalesAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          monthSales:      { $sum: '$totalAmount' },
          monthOrdersCount: { $sum: 1 }
        }
      }
    ]);

    const monthSales       = monthlySalesAgg[0]?.monthSales       || 0;
    const monthOrdersCount = monthlySalesAgg[0]?.monthOrdersCount || 0;

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        totalRolls,
        totalValue,
        totalRetailValue,
        expectedProfit,
        warehouseStats,
        lowStockItems: lowStockItems.map(p => ({
          _id:       p._id,
          name:      p.brand ? `${p.brand} — ${p.artikul}` : p.artikul,
          brand:     p.brand,
          artikul:   p.artikul,
          quantity:  p.quantity,
          minStock:  p.minStock,
          rollLength: p.rollLength,
          warehouse: p.warehouse,
        })),
        topProducts,
        monthSales,
        monthOrdersCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Compare product across all warehouses
// @route   GET /api/products/compare
// @access  Public
exports.getCompareProducts = async (req, res) => {
  try {
    const { artikul, brand } = req.query;
    if (!artikul) return res.status(400).json({ success: false, message: 'Artikul talab qilinadi' });

    const query = { artikul, isActive: true };
    if (brand) query.brand = brand;

    const products = await Product.find(query)
      .populate('warehouse', 'name color location')
      .sort({ quantity: -1 });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get smart replenishment recommendations
// @route   GET /api/products/replenishment
// @access  Private
exports.getReplenishmentRecommendations = async (req, res) => {
  try {
    let targetWarehouseId = req.user.warehouse;

    // Superadmin or admin can request for a specific warehouse
    if ((req.user.role === 'superadmin' || req.user.role === 'admin') && req.query.warehouseId) {
      targetWarehouseId = req.query.warehouseId;
    }

    if (!targetWarehouseId) {
      // If superadmin doesn't specify a warehouse, return empty
      return res.status(200).json({ success: true, data: [] });
    }

    const mongoose = require('mongoose');
    const userWarehouseId = new mongoose.Types.ObjectId(targetWarehouseId);

    const products = await Product.aggregate([
      {
        $match: {
          warehouse: userWarehouseId,
          isActive: true,
          $expr: { $lte: ['$quantity', { $ifNull: ['$minStock', 4] }] }
        }
      },
      {
        $lookup: {
          from: 'products',
          let: { targetArtikul: '$artikul', targetBrand: '$brand' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$artikul', '$$targetArtikul'] },
                    { $eq: [{ $ifNull: ['$brand', ''] }, { $ifNull: ['$$targetBrand', ''] }] },
                    { $ne: ['$warehouse', userWarehouseId] },
                    { $gt: ['$quantity', 0] },
                    { $eq: ['$isActive', true] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'warehouses',
                localField: 'warehouse',
                foreignField: '_id',
                as: 'warehouseDetails'
              }
            },
            { $unwind: { path: '$warehouseDetails', preserveNullAndEmptyArrays: true } },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    '$$ROOT',
                    { warehouse: '$warehouseDetails' }
                  ]
                }
              }
            },
            {
              $project: {
                warehouseDetails: 0
              }
            }
          ],
          as: 'availableInOthers'
        }
      },
      {
        $match: {
          'availableInOthers.0': { $exists: true }
        }
      },
      { $sort: { quantity: 1 } }
    ]);

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Parse text order using AI
// @route   POST /api/products/parse-order
// @access  Public
exports.parseOrder = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

    let parsedArray = [];
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Siz elektron tijorat uchun AI parsersisiz.
Quyidagi matndan foydalanuvchi buyurtma qilmoqchi bo'lgan maxsulotlarni va ularning miqdorini ajratib oling.
Matn: "${text}"
Faqatgina JSON formatda massiv (array) qaytaring, hech qanday qo'shimcha izohsiz.
Har bir obyekt quyidagi maydonlarga ega bo'lsin:
- "matchedText": asl matndagi shu maxsulotga tegishli parcha
- "searchStr": maxsulotning nomi, artikuli yoki kodi (faqat qidiruv uchun eng muhim so'zlarni qoldiring)
- "quantity": miqdori (son)

Agar matnda maxsulot topilmasa, bo'sh massiv [] qaytaring.
Misol:
Matn: "10 dona 25112 dan va 2 ta oq 101"
Natija:
[
  { "matchedText": "10 dona 25112 dan", "searchStr": "25112", "quantity": 10 },
  { "matchedText": "2 ta oq 101", "searchStr": "101 oq", "quantity": 2 }
]`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      let responseText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedArray = JSON.parse(responseText);
    } else {
      // Fallback simple regex parsing
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      parsedArray = lines.map(line => {
        const qtyMatch = line.match(/(\d+)\s*(ta|dona|rulon|metr|quti|dan)/i) || line.match(/^(\d+)/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        const searchStr = line.replace(qtyMatch ? qtyMatch[0] : '', '').replace(/dan/gi, '').trim().replace(/^[^\w\d]+|[^\w\d]+$/g, '');
        return { matchedText: line, searchStr, quantity };
      });
    }

    const results = [];
    for (const item of parsedArray) {
      if (!item.searchStr || item.searchStr.length < 2) continue;
      
      const searchTerms = item.searchStr.split(' ').map(s => s.trim()).filter(Boolean);
      const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
      
      let query = { isActive: true };
      
      if (searchTerms.length > 0) {
        query.$and = searchTerms.map(term => {
          const regex = new RegExp(escapeRegex(term), 'i');
          return {
             $or: [
                { artikul: regex },
                { brand: regex },
                { collection: regex }
             ]
          };
        });
      }

      const products = await Product.find(query).populate('warehouse', 'name color').limit(1).lean();
      
      if (products.length > 0) {
        results.push({
          product: products[0],
          requestedQty: item.quantity,
          matchedText: item.matchedText,
          found: true
        });
      } else {
        results.push({
          product: null,
          requestedQty: item.quantity,
          matchedText: item.matchedText,
          found: false
        });
      }
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
