const express = require('express');
const router = express.Router();
const { login, getMe, getUsers, refreshToken, logout } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// ✅ FIX: PIN login uchun rate limit — 4 xonali PIN brute-force himoyasi
// 15 daqiqada maksimum 10 ta urinish (xuddi password login kabi)
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Juda ko'p PIN urinish. 15 daqiqadan so'ng qayta urinib ko'ring." },
  skipSuccessfulRequests: true, // Muvaffaqiyatli loginlarni sanama
});
// ✅ FIX: Standard login uchun rate limit (Brute-force himoyasi)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 5, // Oddiy login uchun qat'iyroq (5 ta urinish)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Juda ko'p xato urinish. 15 daqiqadan so'ng qayta urinib ko'ring." },
  skipSuccessfulRequests: true,
});

router.post('/login',     loginLimiter, login);
router.post('/login-pin', pinLimiter, require('../controllers/authController').loginPin);
router.post('/refresh',   refreshToken); // HttpOnly cookie orqali
router.post('/logout',    logout);       // Cookie'ni tozalash
router.get('/me',    protect, getMe);
router.get('/users', protect, authorize('superadmin', 'manager'), getUsers);

module.exports = router;
