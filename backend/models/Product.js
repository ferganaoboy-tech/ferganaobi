const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['oboi', 'lyustra', 'laminat', 'other'],
    default: 'oboi'
  },
  unit: {
    type: String,
    enum: ['rulon', 'dona', 'kv.m'],
    default: 'rulon'
  },
  brand: { type: String },
  artikul: { type: String, required: true, uppercase: true, trim: true, minlength: 1 },
  collection: { type: String },
  polka: { type: String },
  design: { 
    type: String, 
    enum: ['geometric','floral','plain','striped','abstract','kids','classic','modern','brick','wood']
  },
  material: { 
    type: String, 
    enum: ['vinyl','flyizelin','paper','textile','bamboo']
  },
  width: { type: Number, default: 1.06 },
  rollLength: { type: Number, default: 10 },
  coverage: { type: Number },
  rollsPerBox: { type: Number, default: 6 },
  
  costPrice: { type: Number, required: true, min: 0 },
  costPriceUsd: { type: Number, min: 0 },
  wholesalePrice: { type: Number, min: 0 },
  wholesalePriceUsd: { type: Number, min: 0 },
  pricePerRoll: { type: Number, required: true, min: 0 }, // Dasturda bu 'Asosiy narx' (Base Price) vazifasini o'taydi
  pricePerRollUsd: { type: Number, min: 0 },
  
  pricePerMeter: { type: Number, min: 0 },
  pricePerBox: { type: Number, min: 0 },
  
  quantity: { type: Number, default: 0, min: 0 },
  soldQuantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 4 },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  images: [{ url: String, publicId: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true, suppressReservedKeysWarning: true });

// Pre-save hook
productSchema.pre('save', function() {
  if (this.width && this.rollLength) {
    this.coverage = this.width * this.rollLength;
  }
  if (this.pricePerRoll) {
    if (this.rollLength) {
      this.pricePerMeter = this.pricePerRoll / this.rollLength;
    }
    if (this.rollsPerBox) {
      this.pricePerBox = this.pricePerRoll * this.rollsPerBox;
    }
  }
});

// Indexes
productSchema.index({ artikul: 1, brand: 1, warehouse: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
productSchema.index({ brand: 'text', artikul: 'text', collection: 'text', polka: 'text' });
productSchema.index({ warehouse: 1, isActive: 1 });
productSchema.index({ material: 1, isActive: 1 });
productSchema.index({ design: 1, isActive: 1 });
productSchema.index({ warehouse: 1, isActive: 1, createdAt: -1 });
productSchema.index({ soldQuantity: -1 });

module.exports = mongoose.model('Product', productSchema);
