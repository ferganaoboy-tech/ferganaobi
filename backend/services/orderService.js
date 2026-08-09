const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Shift = require('../models/Shift');
const { calculateQuantityInRolls } = require('../utils/unitConverter');
const orderEvents = require('../events/orderEvents');
const { logAction } = require('../utils/logger');

/**
 * processOrder — buyurtma yaratish (MongoDB transaction bilan).
 *
 * Barcha yozuvlar (stock kamaytirish, order yaratish, payment, customer update)
 * bitta atomic transaction ichida bajariladi. Xatolik bo'lsa hamma o'zgarish
 * rollback qilinadi — ma'lumotlar inconsistent holatda qolmaydi.
 *
 * @param {Object} orderDataInput — request body
 * @param {Object} user           — req.user (JWT dan)
 * @param {Object} io             — Socket.io instance
 * @returns {Object}              — populated Order document
 */
exports.processOrder = async (orderDataInput, user, io) => {
  const { items, warehouse, customer, status, useCashback, ...orderData } = orderDataInput;

  // 1. Warehouse permission check (transaction tashqarisida — o'qish)
  if (user && user.role !== 'superadmin' && user.role !== 'admin') {
    const userWhId = user.warehouse ? user.warehouse.toString() : null;
    if (!userWhId || userWhId !== warehouse.toString()) {
      throw new Error("Siz faqat o'zingizga biriktirilgan ombordan savdo qila olasiz");
    }
  }

  // 1.5. Smena (Shift) ochiqligini tekshirish — faqat settings'da yoqilgan bo'lsa
  // Settings'dan shiftEnabled flagini o'qiymiz (lean — tezkor)
  const Settings = require('../models/Settings');
  const settings = await Settings.findOne().select('features').lean();
  const shiftEnabled = settings?.features?.shiftEnabled ?? false;

  if (shiftEnabled) {
    // Faqat cashier va warehouse rollari smena ochishi shart
    // Superadmin va admin smena ochmasdan ham savdo qila oladi
    const SHIFT_REQUIRED_ROLES = ['cashier', 'warehouse'];
    if (user && SHIFT_REQUIRED_ROLES.includes(user.role)) {
      const openShift = await Shift.findOne({ user: user._id, status: 'open' }).lean();
      if (!openShift) {
        throw new Error("Smenani ochmasdan turib savdo qila olmaysiz! Iltimos, oldin smenani oching.");
      }
    }
  }


  // 2. Mahsulotlarni tekshirish va birliklarni hisoblash (o'qish — session shart emas)
  let processedItems = [];
  let calculatedTotal = 0;

  for (let item of items) {
    const product = await Product.findById(item.product).lean();
    if (!product || product.isActive === false) {
      throw new Error('Product not found');
    }
    if (product.warehouse.toString() !== warehouse.toString()) {
      throw new Error(`Product ${product.brand || product.artikul} is not in the selected warehouse`);
    }

    const quantityInRolls = calculateQuantityInRolls(item.unit, item.quantity, product);

    if (product.quantity < quantityInRolls) {
      throw new Error(
        `Not enough stock for ${product.brand || product.artikul}. Available: ${product.quantity} ${product.unit || 'rulon'}`
      );
    }

    processedItems.push({
      ...item,
      quantityInRolls,
      unitCost:    product.costPrice    || 0,
      unitCostUsd: product.costPriceUsd || 0,
    });

    // API Bypass Himoyasi: Narxni bazadagi tan narx bilan tekshirish
    const effectiveUnitPrice = item.unitPrice * (1 - (item.discount || 0) / 100);
    if (user && user.role !== 'superadmin' && product.costPrice && effectiveUnitPrice < product.costPrice) {
      throw new Error(
        `Xavfsizlik tizimi: "${product.brand || product.artikul}" mahsulotini tan narxidan (${product.costPrice} so'm) arzon sota olmaysiz! Ruxsat etilmagan operatsiya.`
      );
    }

    const itemSubtotal = effectiveUnitPrice * item.quantity;
    calculatedTotal += itemSubtotal;
  }

  const customerDoc = await Customer.findById(customer).lean();
  if (!customerDoc) throw new Error('Customer not found');

  let finalTotal = orderData.overrideTotalAmount !== undefined
    ? Number(orderData.overrideTotalAmount)
    : calculatedTotal;

  // 3. Cashback hisoblash (o'qish — session shart emas)
  let cashbackUsed = 0;
  if (useCashback && customerDoc.cashbackBalance > 0 && !customerDoc.name.toLowerCase().includes('bir martalik')) {
    cashbackUsed = Math.min(customerDoc.cashbackBalance, finalTotal);
  }

  const amountEligibleForCashback = finalTotal - cashbackUsed;
  
  let cashbackEarned = 0;
  if (!customerDoc.name.toLowerCase().includes('bir martalik') && customerDoc.cashbackPercent > 0) {
    cashbackEarned = Math.round(amountEligibleForCashback * (customerDoc.cashbackPercent / 100));
  }

  // ─── MongoDB Transaction ────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  let populatedOrder;
  let successUpdates = [];
  let finalStatus = status || 'confirmed';

  try {
    await session.withTransaction(async () => {
      successUpdates = [];

      // 4. Confirmed bo'lsa — Atomic stock kamaytirish
      if (finalStatus === 'confirmed') {
        for (let item of processedItems) {
          const updatedProduct = await Product.findOneAndUpdate(
            { _id: item.product, quantity: { $gte: item.quantityInRolls } },
            { $inc: { quantity: -item.quantityInRolls, soldQuantity: item.quantityInRolls } },
            { new: true, session }
          ).populate('warehouse', 'name');

          if (!updatedProduct) {
            const current = await Product.findById(item.product).session(session);
            throw new Error(
              `Skladda yetarli mahsulot yo'q: ${current ? (current.brand || current.artikul) : "Noma'lum"}. Mavjud: ${current ? current.quantity : 0} ta`
            );
          }

          successUpdates.push({ id: item.product, quantity: item.quantityInRolls, productDoc: updatedProduct });
        }
      }

      // 5. Order yaratish
      const order = new Order({
        ...orderData,
        customer,
        seller: user ? user._id : undefined,
        warehouse,
        status: finalStatus,
        items: processedItems,
        cashbackUsed,
        cashbackEarned,
        ...(finalStatus === 'confirmed' ? { confirmedAt: new Date() } : {}),
      });

      await order.save({ session }); // Pre-save hook subtotal/total/debt hisoblaydi

      // 6. Post-confirmation customer yangilash
      if (finalStatus === 'confirmed') {
        const customerUpdates = {
          $inc: {
            totalDebt: Math.max(0, order.debtAmount || 0),
            totalPurchased: order.totalAmount || 0,
          }
        };

        if (cashbackUsed > 0 || cashbackEarned > 0) {
          customerUpdates.$inc.cashbackBalance = cashbackEarned - cashbackUsed;
        }

        await Customer.findByIdAndUpdate(customer, customerUpdates, { session });
      }

      // 7. Boshlang'ich to'lov
      if (order.paidAmount > 0) {
        await Payment.create(
          [{
            order: order._id,
            customer: order.customer,
            warehouse: warehouse,
            amount: order.paidAmount,
            method: order.paymentType === 'naqd' ? 'naqd' : 'karta',
            notes: "Boshlang'ich to'lov",
            receivedBy:   user ? user.name  : 'Tizim',    // String (mos kelish)
            receivedById: user ? user._id   : undefined,  // ObjectId (aniq)
          }],
          { session }
        );
      }

      // 8. Populate (transaction ichida — session bilan)
      populatedOrder = await Order.findById(order._id)
        .populate('customer', 'name phone')
        .populate('warehouse', 'name')
        .populate('seller', 'name')
        .populate('items.product', 'brand artikul polka images category')
        .session(session);
    });
  } finally {
    await session.endSession();
  }

  // 9. Side effects (transaction tashqarisida — muvaffaqiyatdan keyin)
  const syncDeltas = {
    products: [],
    customer: null,
  };

  if (finalStatus === 'confirmed') {
    for (let update of successUpdates) {
      syncDeltas.products.push({
        id: update.productDoc._id.toString(),
        delta: -update.quantity,
      });
      if (update.productDoc.quantity <= update.productDoc.minStock) {
        orderEvents.emit('stockLow', { productDoc: update.productDoc, io });
      }
    }
    
    syncDeltas.customer = {
      id: customer.toString(),
      debtDelta: Math.max(0, populatedOrder.debtAmount),
      purchasedDelta: populatedOrder.totalAmount,
      cashbackDelta: cashbackEarned - cashbackUsed
    };
  }

  orderEvents.emit('orderCreated', { order: populatedOrder, io, syncDeltas });

  if (user) {
    await logAction(
      { user },
      'CREATE',
      'Order',
      populatedOrder._id,
      `Yangi buyurtma yaratildi: ${populatedOrder.orderNumber}`
    );
  }

  return populatedOrder;
};
