const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/logger');

// ─── Token Generators ────────────────────────────────────────────────────────

/**
 * Access token — qisqa muddatli (15 daqiqa).
 * Frontendga JSON orqali yuboriladi, localStorage'da saqlanadi.
 */
const generateAccessToken = (id) => {
  return jwt.sign({ id, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });
};

/**
 * Refresh token — uzoq muddatli (7 kun).
 * HttpOnly cookie orqali yuboriladi — JS'dan o'qib bo'lmaydi.
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh', {
    expiresIn: '7d',
  });
};

/**
 * Refresh token'ni HttpOnly secure cookie'ga yozish.
 */
const setRefreshTokenCookie = (res, token) => {
  res.cookie('crm_refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 kun (ms)
    path: '/api/auth/refresh',
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

// @desc    Auth user & get token
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Login va parolni kiriting' });
    }

    const user = await User.findOne({ username }).select('+password').populate('warehouse');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Noto'g'ri login yoki parol" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Noto'g'ri login yoki parol" });
    }

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user model
    user.refreshToken = refreshToken;
    await user.save();

    // Refresh token — HttpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          warehouse: user.warehouse,
        },
        token: accessToken,
      },
    });

    // Audit log (login javobidan keyin)
    const reqForLogger = { user, ip: req.ip || req.connection?.remoteAddress };
    await logAction(reqForLogger, 'LOGIN', 'User', user._id, `${user.name} tizimga kirdi`);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatosi', error: error.message });
  }
};

// @desc    Auth user with PIN
// @route   POST /api/auth/login-pin
// @access  Public
exports.loginPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN kodni kiriting' });
    }

    // ✅ FIX: PIN endi DB da bcrypt hash sifatida saqlanadi.
    // findOne({ pin }) endi ishlamaydi — barcha aktiv foydalanuvchilar
    // orasidan bcrypt.compare bilan to'g'ri foydalanuvchini topamiz.
    // Foydalanuvchilar odatda 5-20 nafar — bu effektiv.
    const users = await User.findOne({ isActive: true, pin: { $exists: true, $ne: null } })
      .select('+pin')
      .populate('warehouse');

    // Bitta so'rov o'rniga: PIN mavjud bo'lgan foydalanuvchilarni olamiz
    const activeUsersWithPin = await User.find({
      isActive: true,
      pin: { $exists: true, $ne: null }
    }).select('+pin').populate('warehouse');

    let matchedUser = null;
    for (const u of activeUsersWithPin) {
      const isMatch = await u.matchPin(pin);
      if (isMatch) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ success: false, message: "PIN kod noto'g'ri yoki xodim bloklangan" });
    }

    const accessToken  = generateAccessToken(matchedUser._id);
    const refreshToken = generateRefreshToken(matchedUser._id);

    matchedUser.refreshToken = refreshToken;
    await matchedUser.save();

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: matchedUser._id,
          name: matchedUser.name,
          username: matchedUser.username,
          role: matchedUser.role,
          permissions: matchedUser.permissions,
          warehouse: matchedUser.warehouse,
        },
        token: accessToken,
      },
    });

    const reqForLogger = { user: matchedUser, ip: req.ip || req.connection?.remoteAddress };
    await logAction(reqForLogger, 'LOGIN', 'User', matchedUser._id, `${matchedUser.name} PIN orqali tizimga kirdi`);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatosi', error: error.message });
  }
};


// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Cookie (crm_refresh_token)
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.crm_refresh_token;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token topilmadi' });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
      );
    } catch {
      return res.status(401).json({ success: false, message: "Refresh token noto'g'ri yoki muddati o'tgan" });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: "Noto'g'ri token turi" });
    }

    // Faqat access token yangilanadi (Refresh token aylanishini o'chiramiz)
    // Sabab: Multi-tab yoki sahifa yangilanishida "Token Reuse" xatosi tufayli
    // tasodifiy tizimdan chiqib ketishlarning (random logouts) oldini olish.
    const newAccessToken = generateAccessToken(decoded.id);
    
    const user = await User.findOne({ 
      _id: decoded.id, 
      refreshToken: token 
    }).populate('warehouse');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi yoki bloklangan' });
    }

    // Refresh tokenni yangilamaymiz, eskisini qoldiramiz.

    res.status(200).json({
      success: true,
      data: {
        token: newAccessToken,
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          warehouse: user.warehouse,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// @desc    Logout — refresh token cookie'ni tozalash
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  // Clear from DB if user is authenticated (using req.user if available)
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, { $unset: { refreshToken: 1 } });
  } else {
    // Try to clear based on the cookie if req.user is not present
    const token = req.cookies?.crm_refresh_token;
    if (token) {
      await User.findOneAndUpdate({ refreshToken: token }, { $unset: { refreshToken: 1 } });
    }
  }

  res.clearCookie('crm_refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth/refresh',
  });
  res.status(200).json({ success: true, message: 'Tizimdan chiqildi' });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('warehouse');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatosi', error: error.message });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().populate('warehouse');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server xatosi', error: error.message });
  }
};
