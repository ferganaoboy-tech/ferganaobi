const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect — JWT access token tekshiruvi.
 *
 * Token quyidagi tartibda qidiriladi:
 *   1. Authorization: Bearer <token> header'i
 *   2. crm_access_token cookie (ixtiyoriy, kelajakda)
 *
 * Refresh token (/api/auth/refresh) alohida ko'rib chiqiladi.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Header'dan olish
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Kirish uchun ruxsat yo'q. Iltimos tizimga kiring.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Refresh token bilan access endpoint'ga kirish oldini olish
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: "Noto'g'ri token turi." });
    }

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Foydalanuvchi topilmadi yoki bloklangan.',
      });
    }

    next();
  } catch (error) {
    // Muddati o'tgan token — frontendga aniq signal berish
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token muddati o'tgan.",
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: "Noto'g'ri yoki muddati o'tgan token.",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bu amalni bajarish uchun sizda huquq yo\'q',
      });
    }
    next();
  };
};

const authorizeWithPermission = (permission, ...roles) => {
  return (req, res, next) => {
    // Superadmin va admin uchun avtomatik ruxsat, yoxud ularning rollari ruxsat berilganlar qatorida bo'lsa
    if (['superadmin', 'admin'].includes(req.user.role) || roles.includes(req.user.role)) {
      return next();
    }
    // Yoki foydalanuvchida maxsus huquq (permission) bor bo'lsa
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Bu amalni bajarish uchun sizda huquq yo\'q',
    });
  };
};

module.exports = { protect, authorize, authorizeWithPermission };
