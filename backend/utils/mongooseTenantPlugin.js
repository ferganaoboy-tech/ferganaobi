const { tenantStorage } = require('./tenantContext');

module.exports = function tenantPlugin(schema) {
  // Mongoose'dagi barcha izlash va tahrirlash funksiyalariga aralashamiz
  const readAndUpdateMethods = [
    'find', 'findOne', 'findOneAndDelete', 'findOneAndRemove',
    'findOneAndUpdate', 'update', 'updateOne', 'updateMany',
    'deleteOne', 'deleteMany', 'count', 'countDocuments'
  ];

  readAndUpdateMethods.forEach(method => {
    schema.pre(method, function (next) {
      const store = tenantStorage.getStore();
      // Agar joriy foydalanuvchi qaysidir warehouse'ga biriktirilgan bo'lsa
      // va ushbu Schema da 'warehouse' field bo'lsa:
      if (store && store.warehouseId && this.schema.paths.warehouse) {
        // 1. Shartni majburiy qo'shamiz (IDOR block - boshqa filialni topa olmaslik uchun)
        this.where({ warehouse: store.warehouseId });
        
        // 2. Yozish operatsiyalarida update body ichidan warehouse ni o'zgartirishni bloklaymiz (Mass Assignment block)
        if (['findOneAndUpdate', 'update', 'updateOne', 'updateMany'].includes(method)) {
          const updateObj = this.getUpdate();
          if (updateObj) {
            // Agar $set ishlatilgan bo'lsa
            if (updateObj.$set && updateObj.$set.warehouse) {
              updateObj.$set.warehouse = store.warehouseId;
            }
            // Agar to'g'ridan-to'g'ri o'zgartirilayotgan bo'lsa
            if (updateObj.warehouse) {
              updateObj.warehouse = store.warehouseId;
            }
          }
        }
      }
      next();
    });
  });

  // Aggregation (Dashboard/Stats) so'rovlariga aralashamiz
  schema.pre('aggregate', function (next) {
    const store = tenantStorage.getStore();
    // Aggregation qilinayotgan Model 'warehouse' ni o'z ichiga oladimi?
    // Aggregation model instance emas, shuning uchun schema.paths dan izlaymiz
    if (store && store.warehouseId && schema.paths.warehouse) {
      this.pipeline().unshift({ $match: { warehouse: store.warehouseId } });
    }
    next();
  });

  // Yangi hujjat qo'shilayotganda majburiy warehouse beramiz (Mass Assignment block)
  schema.pre('save', function (next) {
    const store = tenantStorage.getStore();
    if (store && store.warehouseId && this.schema.paths.warehouse) {
      // Dasturchi boshqa warehouse yuborgan bo'lsa ham uning o'z filialiga tushadi
      this.warehouse = store.warehouseId;
    }
    next();
  });

  // insertMany orqali birdaniga ko'p hujjat qo'shilayotganda
  schema.pre('insertMany', function (next, docs) {
    const store = tenantStorage.getStore();
    if (store && store.warehouseId && schema.paths.warehouse) {
      if (Array.isArray(docs)) {
        docs.forEach(doc => {
          doc.warehouse = store.warehouseId;
        });
      }
    }
    next();
  });
};
