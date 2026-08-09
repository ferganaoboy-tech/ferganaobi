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

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
