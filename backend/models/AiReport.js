const mongoose = require('mongoose');

const AiReportSchema = new mongoose.Schema({
  reportText: {
    type: String,
    required: true
  },
  modelUsed: {
    type: String,
    required: true
  },
  stats: {
    totalProducts: Number,
    outOfStock: Number,
    topSellersCount: Number,
    inStock: Number,
    lowStock: Number
  },
  chartData: [{
    name: String,
    sotilgan_rulon: Number,
    tushum: Number
  }],
  inventoryData: [{
    name: String,
    value: Number,
    color: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AiReport', AiReportSchema);
