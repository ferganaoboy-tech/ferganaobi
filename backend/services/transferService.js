const mongoose = require('mongoose');
const Transfer = require('../models/Transfer');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const Counter = require('../models/Counter');
const telegramBot = require('../utils/telegramBot');
const { calculateQuantityInRolls } = require('../utils/unitConverter');
const { logAction } = require('../utils/logger');
const { sendPushToWarehouse } = require('../controllers/pushController');

const generateTransferNumber = async (session) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'transferNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `TR-${counter.seq.toString().padStart(5, '0')}`;
};

exports.createTransfer = async (data, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const { toWarehouse, items, notes } = data;
    let fromWarehouse = user.warehouse;

    if (!fromWarehouse && user.role === 'superadmin') {
      fromWarehouse = data.fromWarehouse;
    }

    if (!fromWarehouse) {
      throw new Error("Foydalanuvchiga filial biriktirilmagan yoki manba filial ko'rsatilmagan.");
    }
    if (fromWarehouse.toString() === toWarehouse) {
      throw new Error("Bir xil filialga mahsulot ko'chirib bo'lmaydi.");
    }
    if (!items || items.length === 0) {
      throw new Error("O'tkazish uchun mahsulotlar tanlanmagan.");
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error("Miqdor noto'g'ri kiritilgan.");
      }
      if (!item.unit) {
        item.unit = 'rulon'; // Fallback
      }
      const product = await Product.findById(item.product).lean();
      if (!product) {
        throw new Error(`Mahsulot topilmadi: ${item.product}`);
      }
      if (!product.isActive) {
        throw new Error(`Mahsulot (${product.artikul}) passiv holatda, o'tkazib bo'lmaydi.`);
      }
      if (product.warehouse.toString() !== fromWarehouse.toString()) {
        throw new Error(`Mahsulot (${product.artikul}) bu filialga tegishli emas.`);
      }
    }

    const destWarehouse = await Warehouse.findById(toWarehouse).lean();
    if (!destWarehouse || !destWarehouse.isActive) {
      throw new Error("Qabul qiluvchi filial topilmadi yoki yopilgan (passiv).");
    }

    let populatedTransfer;

    await session.withTransaction(async () => {
      const transferItems = [];

      for (const item of items) {
        const productForCalc = await Product.findById(item.product).lean();
        const baseQuantity = calculateQuantityInRolls(item.unit || productForCalc.unit || 'rulon', item.quantity, productForCalc);

        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.product,
            quantity: { $gte: baseQuantity }
          },
          { $inc: { quantity: -baseQuantity } },
          { new: true, session }
        );

        if (!updatedProduct) {
          const current = await Product.findById(item.product).session(session);
          throw new Error(
            `Skladda yetarli mahsulot yo'q: ${current ? current.artikul : item.product}. ` +
            `Mavjud: ${current ? current.quantity : 0} ta, so'ralgan: ${item.quantity} ta`
          );
        }

        transferItems.push({
          product: updatedProduct._id,
          artikul: updatedProduct.artikul,
          quantity: item.quantity,
          unit: item.unit || updatedProduct.unit || 'rulon',
          baseQuantity,
          costPrice: updatedProduct.costPrice,
          pricePerRoll: updatedProduct.pricePerRoll
        });
      }

      const transferNumber = await generateTransferNumber(session);

      const [transfer] = await Transfer.create([{
        transferNumber,
        fromWarehouse,
        toWarehouse,
        items: transferItems,
        sentBy: user._id,
        notes
      }], { session });

      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name color')
        .populate('toWarehouse', 'name color')
        .populate('sentBy', 'name')
        .populate('items.product', 'brand artikul collection images')
        .session(session);
    });

    if (io) {
      io.to([fromWarehouse.toString(), toWarehouse.toString()])
        .emit('transfer:incoming', populatedTransfer);

      for (const item of items) {
        const updProd = await Product.findById(item.product).populate('warehouse', 'name color');
        if (updProd) {
          io.to(fromWarehouse.toString()).emit('product:updated', updProd);
        }
      }
    }

    telegramBot.sendTransferReceipt(populatedTransfer).catch(err =>
      console.error("Telegram transfer xatosi:", err)
    );

    sendPushToWarehouse(toWarehouse, {
      title: "Yangi O'tkazma",
      body: `${populatedTransfer.fromWarehouse?.name} filialidan mahsulotlar yuborildi. Iltimos qabul qiling.`,
      icon: "/logo.png",
      url: "/transfers"
    }).catch(err => console.error("Web Push xatosi:", err));

    await logAction(reqContext, 'CREATE', 'Transfer', populatedTransfer._id,
      `Ko'chirish yaratildi: ${populatedTransfer.transferNumber}`
    );

    return populatedTransfer;
  } finally {
    await session.endSession();
  }
};

exports.getTransfers = async (queryParam, user) => {
  const { type, page = 1, limit = 20, warehouseId: reqWarehouseId } = queryParam;
  let warehouseId = user.warehouse;
  const isSuper = user.role === 'superadmin' || user.role === 'admin';

  if (isSuper && reqWarehouseId) {
    warehouseId = reqWarehouseId;
  }

  let query = {};
  if (isSuper) {
    if (warehouseId) {
      if (type === 'sent') {
        query.$or = [{ fromWarehouse: warehouseId, type: 'send' }, { toWarehouse: warehouseId, type: 'request' }];
      } else if (type === 'received') {
        query.$or = [{ toWarehouse: warehouseId, type: 'send' }, { fromWarehouse: warehouseId, type: 'request' }];
      }
    }
  } else {
    if (!warehouseId) {
      throw new Error('Foydalanuvchiga filial biriktirilmagan.');
    }
    if (type === 'sent') {
      query.$or = [{ fromWarehouse: warehouseId, type: { $ne: 'request' } }, { toWarehouse: warehouseId, type: 'request' }];
    } else if (type === 'received') {
      query.$or = [{ toWarehouse: warehouseId, type: { $ne: 'request' } }, { fromWarehouse: warehouseId, type: 'request' }];
    } else {
      query.$or = [{ fromWarehouse: warehouseId }, { toWarehouse: warehouseId }];
    }
  }

  const startIndex = (Number(page) - 1) * Number(limit);
  const total = await Transfer.countDocuments(query);

  const transfers = await Transfer.find(query)
    .populate('fromWarehouse', 'name color')
    .populate('toWarehouse', 'name color')
    .populate('sentBy', 'name')
    .populate('receivedBy', 'name')
    .populate('items.product', 'brand artikul collection images')
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(Number(limit))
    .lean();

  return { transfers, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } };
};

exports.getPendingCount = async (user) => {
  const warehouseId = user.warehouse;
  let query = {};
  const isSuper = user.role === 'superadmin' || user.role === 'admin';

  if (isSuper) {
    if (warehouseId) {
      query.$or = [
        { toWarehouse: warehouseId, type: { $ne: 'request' }, status: 'pending' },
        { fromWarehouse: warehouseId, type: 'request', status: 'requested' }
      ];
    } else {
      // Superadmin with no selected warehouse sees all pending actions
      query.$or = [
        { type: { $ne: 'request' }, status: 'pending' },
        { type: 'request', status: 'requested' }
      ];
    }
  } else {
    if (!warehouseId) return 0;
    query.$or = [
      { toWarehouse: warehouseId, type: { $ne: 'request' }, status: 'pending' },
      { fromWarehouse: warehouseId, type: 'request', status: 'requested' }
    ];
  }

  return await Transfer.countDocuments(query);
};

exports.getTransferById = async (id) => {
  const transfer = await Transfer.findById(id)
    .populate('fromWarehouse', 'name color location')
    .populate('toWarehouse', 'name color location')
    .populate('sentBy', 'name')
    .populate('receivedBy', 'name')
    .populate('items.product', 'brand artikul collection images');

  if (!transfer) {
    throw new Error("O'tkazma topilmadi");
  }
  return transfer;
};

exports.acceptTransfer = async (transferId, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const transfer = await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'pending' },
      { status: 'processing' },
      { new: true }
    );
    if (!transfer) {
      throw new Error("O'tkazma topilmadi yoki allaqachon ko'rib chiqilgan.");
    }

    if (
      user.role !== 'superadmin' &&
      transfer.toWarehouse.toString() !== user.warehouse.toString()
    ) {
      await Transfer.findByIdAndUpdate(transferId, { status: 'pending' });
      throw new Error('Faqat qabul qiluvchi filial tasdiqlashi mumkin.');
    }

    let populatedTransfer;

    try {
      await session.withTransaction(async () => {
        for (const item of transfer.items) {
          const originalProduct = await Product.findById(item.product).session(session);
          if (!originalProduct) continue;

          let destProduct = await Product.findOne({
            artikul: originalProduct.artikul,
            warehouse: transfer.toWarehouse
          }).session(session);

          if (destProduct) {
            destProduct = await Product.findOneAndUpdate(
              { _id: destProduct._id },
              { $inc: { quantity: item.baseQuantity || item.quantity }, $set: { isActive: true } },
              { new: true, session }
            ).populate('warehouse', 'name color');

            if (io) io.to(transfer.toWarehouse.toString()).emit('product:updated', destProduct);
          } else {
            const productData = originalProduct.toObject();
            delete productData._id;
            delete productData.createdAt;
            delete productData.updatedAt;
            delete productData.__v;

            productData.warehouse = transfer.toWarehouse;
            productData.quantity = item.baseQuantity || item.quantity;
            productData.soldQuantity = 0;
            productData.isActive = true;

            const [newProduct] = await Product.create([productData], { session });
            const populated = await Product.findById(newProduct._id)
              .populate('warehouse', 'name color')
              .session(session);

            if (io) io.to(transfer.toWarehouse.toString()).emit('product:created', populated);
          }
        }

        await Transfer.findByIdAndUpdate(
          transfer._id,
          {
            status: 'completed',
            receivedBy: user._id,
            receivedAt: new Date()
          },
          { session }
        );

        populatedTransfer = await Transfer.findById(transfer._id)
          .populate('fromWarehouse', 'name')
          .populate('toWarehouse', 'name')
          .populate('sentBy', 'name')
          .populate('receivedBy', 'name')
          .populate('items.product', 'brand artikul collection images')
          .session(session);
      });
    } catch (txnError) {
      await Transfer.findOneAndUpdate(
        { _id: transferId, status: 'processing' },
        { status: 'pending' }
      ).catch(rollbackErr =>
        console.error('Transfer rollback xatosi:', rollbackErr.message)
      );
      throw txnError;
    }

    if (io) {
      io.to([transfer.fromWarehouse.toString(), transfer.toWarehouse.toString()])
        .emit('transfer:updated', populatedTransfer);
    }

    sendPushToWarehouse(transfer.fromWarehouse, {
      title: "✅ Tovarlar qabul qilindi",
      body: `Siz yuborgan ${transfer.transferNumber} raqamli o'tkazma qabul qilindi.`,
      url: "/dashboard"
    }).catch(err => console.error("Web Push qabul xatosi:", err));

    telegramBot.sendTransferReceipt(populatedTransfer).catch(err =>
      console.error("Telegram transfer qabul xatosi:", err)
    );

    await logAction(reqContext, 'UPDATE', 'Transfer', transfer._id,
      `Ko'chirish qabul qilindi: ${transfer.transferNumber}`
    );

    return populatedTransfer;
  } finally {
    await session.endSession();
  }
};

exports.rejectTransfer = async (transferId, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const transfer = await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'pending' },
      { status: 'processing' },
      { new: true }
    );
    if (!transfer) {
      throw new Error("Topilmadi yoki allaqachon ko'rib chiqilgan.");
    }

    if (
      user.role !== 'superadmin' &&
      transfer.toWarehouse.toString() !== user.warehouse.toString()
    ) {
      await Transfer.findByIdAndUpdate(transferId, { status: 'pending' });
      throw new Error('Faqat qabul qiluvchi filial rad eta oladi.');
    }

    let populatedTransfer;

    await session.withTransaction(async () => {
      for (const item of transfer.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.baseQuantity || item.quantity }, $set: { isActive: true } },
          { session }
        );
      }

      await Transfer.findByIdAndUpdate(
        transfer._id,
        { status: 'rejected' },
        { session }
      );

      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name color')
        .populate('toWarehouse', 'name color')
        .session(session);
    });

    if (io) {
      for (const item of transfer.items) {
        const updProd = await Product.findById(item.product).populate('warehouse', 'name color');
        if (updProd) io.to(transfer.fromWarehouse.toString()).emit('product:updated', updProd);
      }
      io.to(transfer.fromWarehouse.toString()).emit('transfer:updated', populatedTransfer);
      io.to(transfer.toWarehouse.toString()).emit('transfer:updated', populatedTransfer);
    }

    sendPushToWarehouse(transfer.fromWarehouse, {
      title: "❌ O'tkazma rad etildi",
      body: `Siz yuborgan ${transfer.transferNumber} raqamli o'tkazma qabul qilinmadi va tovarlar omboringizga qaytarildi.`,
      url: "/dashboard"
    }).catch(err => console.error("Web Push rad xatosi:", err));

    await logAction(reqContext, 'UPDATE', 'Transfer', transfer._id,
      `Ko'chirish rad etildi: ${transfer.transferNumber}`
    );

    return populatedTransfer;
  } catch (error) {
    await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'processing' },
      { status: 'pending' }
    );
    throw error;
  } finally {
    await session.endSession();
  }
};

exports.cancelTransfer = async (transferId, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const transfer = await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'pending' },
      { status: 'processing' },
      { new: true }
    );
    if (!transfer) {
      throw new Error("Topilmadi yoki allaqachon ko'rib chiqilgan.");
    }

    if (
      user.role !== 'superadmin' &&
      transfer.fromWarehouse.toString() !== user.warehouse.toString()
    ) {
      await Transfer.findByIdAndUpdate(transferId, { status: 'pending' });
      throw new Error('Faqat yuboruvchi filial bekor qila oladi.');
    }

    let populatedTransfer;

    await session.withTransaction(async () => {
      for (const item of transfer.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.baseQuantity || item.quantity }, $set: { isActive: true } },
          { session }
        );
      }

      await Transfer.findByIdAndUpdate(
        transfer._id,
        { status: 'cancelled' },
        { session }
      );

      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name color')
        .populate('toWarehouse', 'name color')
        .session(session);
    });

    if (io) {
      for (const item of transfer.items) {
        const updProd = await Product.findById(item.product).populate('warehouse', 'name color');
        if (updProd) io.to(transfer.fromWarehouse.toString()).emit('product:updated', updProd);
      }
      io.to(transfer.fromWarehouse.toString()).emit('transfer:updated', populatedTransfer);
      io.to(transfer.toWarehouse.toString()).emit('transfer:updated', populatedTransfer);
    }

    await logAction(reqContext, 'UPDATE', 'Transfer', transfer._id,
      `Ko'chirish bekor qilindi: ${transfer.transferNumber}`
    );

    return populatedTransfer;
  } catch (error) {
    await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'processing' },
      { status: 'pending' }
    );
    throw error;
  } finally {
    await session.endSession();
  }
};

exports.createTransferRequest = async (data, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const { fromWarehouse, items, notes } = data;
    let toWarehouse = user.warehouse;

    if (!toWarehouse && user.role === 'superadmin') {
      toWarehouse = data.toWarehouse;
    }

    if (!toWarehouse || !fromWarehouse) {
      throw new Error("Manba va maqsad filiallar aniq emas.");
    }
    if (fromWarehouse.toString() === toWarehouse.toString()) {
      throw new Error("Bir xil filialga so'rov yuborib bo'lmaydi.");
    }
    if (!items || items.length === 0) {
      throw new Error("So'raladigan mahsulotlar tanlanmagan.");
    }

    let populatedTransfer;

    await session.withTransaction(async () => {
      const transferItems = [];
      for (const item of items) {
        if (item.quantity <= 0) throw new Error("Miqdor noto'g'ri kiritilgan.");
        
        const product = await Product.findById(item.product).session(session);
        if (!product || !product.isActive) {
          throw new Error(`Mahsulot topilmadi yoki yopiq: ${item.product}`);
        }
        if (product.warehouse.toString() !== fromWarehouse.toString()) {
          throw new Error(`Mahsulot bu filialga tegishli emas: ${product.artikul}`);
        }
        
        const baseQuantity = calculateQuantityInRolls(item.unit || product.unit || 'rulon', item.quantity, product);
        
        if (product.quantity < baseQuantity) {
          throw new Error(`Filialda yetarli mahsulot yo'q: ${product.artikul}. Mavjud: ${product.quantity}`);
        }

        transferItems.push({
          product: product._id,
          artikul: product.artikul,
          quantity: item.quantity,
          unit: item.unit || product.unit || 'rulon',
          baseQuantity,
          costPrice: product.costPrice,
          pricePerRoll: product.pricePerRoll
        });
      }

      const transferNumber = await generateTransferNumber(session);

      const [transfer] = await Transfer.create([{
        transferNumber,
        type: 'request',
        status: 'requested',
        fromWarehouse,
        toWarehouse,
        items: transferItems,
        sentBy: user._id,
        notes
      }], { session });

      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name color')
        .populate('toWarehouse', 'name color')
        .populate('sentBy', 'name')
        .populate('items.product', 'brand artikul collection images')
        .session(session);
    });

    if (io) {
      io.to([fromWarehouse.toString(), toWarehouse.toString()]).emit('transfer:incoming', populatedTransfer);
    }

    sendPushToWarehouse(fromWarehouse, {
      title: "🔔 Yangi mahsulot so'rovi",
      body: `${populatedTransfer.toWarehouse?.name} filiali mahsulot so'ramoqda.`,
      icon: "/logo.png",
      url: "/transfers"
    }).catch(err => console.error("Web Push xatosi:", err));

    telegramBot.sendTransferRequestNotification(populatedTransfer).catch(err => console.error(err));
    await logAction(reqContext, 'CREATE', 'Transfer', populatedTransfer._id, `So'rov yuborildi: ${populatedTransfer.transferNumber}`);

    return populatedTransfer;
  } finally {
    await session.endSession();
  }
};

exports.approveTransferRequest = async (transferId, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const transfer = await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'requested', type: 'request' },
      { status: 'processing' },
      { new: true }
    );
    if (!transfer) {
      throw new Error("So'rov topilmadi yoki allaqachon ko'rib chiqilgan.");
    }

    if (user.role !== 'superadmin' && transfer.fromWarehouse.toString() !== user.warehouse.toString()) {
      await Transfer.findByIdAndUpdate(transferId, { status: 'requested' });
      throw new Error("Faqat manba filial so'rovni tasdiqlashi mumkin.");
    }

    let populatedTransfer;

    await session.withTransaction(async () => {
      for (const item of transfer.items) {
        const updatedSourceProduct = await Product.findOneAndUpdate(
          { _id: item.product, quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity } },
          { new: true, session }
        ).populate('warehouse', 'name color');

        if (!updatedSourceProduct) {
          throw new Error(`Skladda yetarli mahsulot qolmagan: ${item.artikul}`);
        }
        if (io) io.to(transfer.fromWarehouse.toString()).emit('product:updated', updatedSourceProduct);

        let destProduct = await Product.findOne({ artikul: item.artikul, warehouse: transfer.toWarehouse }).session(session);
        if (destProduct) {
          destProduct = await Product.findOneAndUpdate(
            { _id: destProduct._id },
            { $inc: { quantity: item.quantity }, $set: { isActive: true } },
            { new: true, session }
          ).populate('warehouse', 'name color');
          if (io) io.to(transfer.toWarehouse.toString()).emit('product:updated', destProduct);
        } else {
          const productData = updatedSourceProduct.toObject();
          delete productData._id;
          delete productData.createdAt; delete productData.updatedAt; delete productData.__v;
          productData.warehouse = transfer.toWarehouse;
          productData.quantity = item.quantity;
          productData.soldQuantity = 0;
          productData.isActive = true;

          const [newProduct] = await Product.create([productData], { session });
          const populated = await Product.findById(newProduct._id).populate('warehouse', 'name color').session(session);
          if (io) io.to(transfer.toWarehouse.toString()).emit('product:created', populated);
        }
      }

      await Transfer.findByIdAndUpdate(transfer._id, { status: 'completed', receivedAt: new Date() }, { session });
      
      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name')
        .populate('toWarehouse', 'name')
        .populate('sentBy', 'name')
        .populate('items.product', 'brand artikul collection images')
        .session(session);
    });

    if (io) {
      io.to([transfer.fromWarehouse.toString(), transfer.toWarehouse.toString()]).emit('transfer:updated', populatedTransfer);
    }

    sendPushToWarehouse(transfer.toWarehouse, {
      title: "✅ So'rov tasdiqlandi",
      body: `Siz so'ragan ${transfer.transferNumber} raqamli mahsulotlar omboringizga qo'shildi.`,
      url: "/dashboard"
    }).catch(err => console.error(err));

    telegramBot.sendTransferRequestApprovedNotification(populatedTransfer).catch(err => console.error(err));
    await logAction(reqContext, 'UPDATE', 'Transfer', transfer._id, `So'rov tasdiqlandi va yakunlandi: ${transfer.transferNumber}`);

    return populatedTransfer;
  } catch (error) {
    await Transfer.findOneAndUpdate({ _id: transferId, status: 'processing' }, { status: 'requested' });
    throw error;
  } finally {
    await session.endSession();
  }
};

exports.rejectTransferRequest = async (transferId, user, io, reqContext) => {
  const session = await mongoose.startSession();
  try {
    const transfer = await Transfer.findOneAndUpdate(
      { _id: transferId, status: 'requested', type: 'request' },
      { status: 'processing' },
      { new: true }
    );
    if (!transfer) {
      throw new Error("So'rov topilmadi yoki ko'rib chiqilgan.");
    }

    if (user.role !== 'superadmin' && transfer.fromWarehouse.toString() !== user.warehouse.toString()) {
      await Transfer.findByIdAndUpdate(transferId, { status: 'requested' });
      throw new Error("Faqat manba filial so'rovni rad eta oladi.");
    }

    let populatedTransfer;
    await session.withTransaction(async () => {
      await Transfer.findByIdAndUpdate(transfer._id, { status: 'rejected' }, { session });
      populatedTransfer = await Transfer.findById(transfer._id)
        .populate('fromWarehouse', 'name color')
        .populate('toWarehouse', 'name color')
        .session(session);
    });

    if (io) {
      io.to([transfer.fromWarehouse.toString(), transfer.toWarehouse.toString()]).emit('transfer:updated', populatedTransfer);
    }

    sendPushToWarehouse(transfer.toWarehouse, {
      title: "❌ So'rov rad etildi",
      body: `Sizning ${transfer.transferNumber} raqamli so'rovingiz rad etildi.`,
      url: "/dashboard"
    }).catch(err => console.error(err));

    telegramBot.sendTransferRequestRejectedNotification(populatedTransfer).catch(err => console.error(err));
    await logAction(reqContext, 'UPDATE', 'Transfer', transfer._id, `So'rov rad etildi: ${transfer.transferNumber}`);
    
    return populatedTransfer;
  } catch (error) {
    await Transfer.findOneAndUpdate({ _id: transferId, status: 'processing' }, { status: 'requested' });
    throw error;
  } finally {
    await session.endSession();
  }
};
