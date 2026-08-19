const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  pin: { type: String, unique: true, sparse: true, select: false },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'manager', 'cashier', 'warehouse'],
    default: 'cashier'
  },
  permissions: [{
    type: String,
    enum: ['manage_products', 'manage_orders', 'manage_customers', 'manage_returns', 'manage_finances']
  }],
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null
  },
  refreshToken: { type: String, select: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ─── Password hashing (pre-save) ─────────────────────────────────────────────
userSchema.pre('save', async function () {
  // Parol o'zgartirilmagan bo'lsa — skip
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // ✅ PIN hashlashtirish — plain text DB da saqlanmaydi
  // PIN o'zgartirilgan va null bo'lmagan bo'lsagina hash qilinadi
  if (this.isModified('pin') && this.pin) {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * matchPin — kiritilgan PIN ni DB dagi hash bilan taqqoslash.
 * findOne({ pin }) o'rniga endi findOne + matchPin ishlatiladi.
 */
userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model('User', userSchema);
