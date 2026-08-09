const User = require('../models/User');
const { logAction } = require('../utils/logger');
const bcrypt = require('bcryptjs');

// @desc    Get all users (employees)
// @route   GET /api/users
// @access  Private (Admin/Superadmin)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password +pin').populate('warehouse').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (Admin/Superadmin)
exports.createUser = async (req, res) => {
  try {
    const { name, username, password, pin, role, permissions, warehouse } = req.body;

    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Bu login (username) band qilingan' });
    }
    const user = await User.create({
      name,
      username,
      password,
      pin: pin || null,
      role,
      warehouse: warehouse || null,
      permissions: permissions || []
    });

    const userResponse = await User.findById(user._id).select('-password').populate('warehouse');
    
    await logAction(req, 'CREATE', 'User', user._id, `Yangi xodim qo'shildi: ${name} (${role})`);

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin/Superadmin)
exports.updateUser = async (req, res) => {
  try {
    const { name, username, password, pin, role, permissions, isActive, warehouse } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Xodim topilmadi' });
    }

    if (username && username !== user.username) {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Bu login (username) band qilingan' });
        }
    }

    user.name = name || user.name;
    user.username = username || user.username;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;
    if (warehouse !== undefined) user.warehouse = warehouse || null;
    if (isActive !== undefined) user.isActive = isActive;
    if (pin !== undefined) user.pin = pin || null;
    
    if (password) {
      user.password = password; // pre-save hook will hash it
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password').populate('warehouse');

    await logAction(req, 'UPDATE', 'User', user._id, `Xodim ma'lumotlari yangilandi: ${user.name}`);

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete (soft delete) user
// @route   DELETE /api/users/:id
// @access  Private (Admin/Superadmin)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Xodim topilmadi' });
    }

    if (user.role === 'superadmin') {
      return res.status(400).json({ success: false, message: 'Asosiy rahbarni o\'chirib bo\'lmaydi' });
    }

    user.isActive = false;
    await user.save();

    await logAction(req, 'DELETE', 'User', user._id, `Xodim tizimdan o'chirildi (bloklandi): ${user.name}`);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
