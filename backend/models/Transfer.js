const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  artikul: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { 
    type: String, 
    enum: ['rulon', 'quti', 'metr', 'dona', 'kv.m'], 
    default: 'rulon' 
  },
  baseQuantity: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  pricePerRoll: { type: Number, required: true },
});

const transferSchema = new mongoose.Schema({
  transferNumber: { type: String, required: true, unique: true },
  fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  items: [transferItemSchema],
  type: { 
    type: String, 
    enum: ['send', 'request'], 
    default: 'send' 
  },
  status: { 
    type: String, 
    enum: ['requested', 'pending', 'processing', 'completed', 'rejected', 'cancelled'], 
    default: 'pending' 
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { timestamps: true });

transferSchema.index({ fromWarehouse: 1, createdAt: -1 });
transferSchema.index({ toWarehouse: 1, createdAt: -1 });
transferSchema.index({ status: 1 });

module.exports = mongoose.model('Transfer', transferSchema);
