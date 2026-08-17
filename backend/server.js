const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const errorHandler = require('./middleware/errorHandler');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

dotenv.config();

// Majburiy environment variables tekshiruvi
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Muhim environment variables topilmadi: ${missingEnv.join(', ')}`);
  console.error('Iltimos .env faylini tekshiring va server ni qayta ishga tushiring.');
  process.exit(1);
}

// Ixtiyoriy lekin muhim env ogohlantirish
if (!process.env.TELEGRAM_ADMIN_CHAT_ID && !process.env.TELEGRAM_CHAT_ID) {
  console.warn('⚠️  TELEGRAM_ADMIN_CHAT_ID o\'rnatilmagan! Bot obunachilari admin tomonidan tasdiqlanmaydi.');
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.warn('⚠️  JWT_REFRESH_SECRET o\'rnatilmagan — JWT_SECRET ishlatiladi (xavfsizroq secret o\'rnatish tavsiya etiladi).');
}

const app = express();
// ✅ MUHIM: Render kabi cloud xizmatlarida to'g'ri IP ni aniqlash uchun (Rate limit xatosi bo'lmasligi uchun)
app.set('trust proxy', 1);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: ${origin} ruxsat etilmagan`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); // Refresh token HttpOnly cookie'sini o'qish uchun
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ✅ Xavfsizlik: Helmet orqali HTTP sarlavhalarini himoyalash
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // API uchun CORS bilan ishlashi uchun
  contentSecurityPolicy: false, // React (Vite) ilovalari alohida ishlaganda bloklanmasligi uchun
}));

// ✅ FIX: NoSQL Injection himoyasi (Express 5.x ga moslashgan custom versiya)
// Express 5.x da req.query getter hisoblanadi, shuning uchun express-mongo-sanitize xato beradi.
const sanitizeMongoObj = (obj) => {
  if (Array.isArray(obj)) {
    obj.forEach(sanitizeMongoObj);
  } else if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith('$') || key.includes('.')) {
        const safeKey = key.replace(/^\$|\./g, '_');
        obj[safeKey] = obj[key];
        delete obj[key];
        sanitizeMongoObj(obj[safeKey]);
      } else {
        sanitizeMongoObj(obj[key]);
      }
    });
  }
};

app.use((req, res, next) => {
  if (req.body) sanitizeMongoObj(req.body);
  if (req.params) sanitizeMongoObj(req.params);
  if (req.query) sanitizeMongoObj(req.query);
  next();
});

// Database Connection
// ✅ Database Optimizatsiyasi: Jonli (Production) muhitda indekslarni qayta qurishni to'xtatish
const isProduction = process.env.NODE_ENV === 'production';
mongoose.set('autoIndex', !isProduction);

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wallpaper-crm', {
    maxPoolSize: 200
  })
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Initialize scheduled jobs
    const initDailyReportJob = require('./jobs/dailyReport');
    const initWeeklyBackupJob = require('./jobs/weeklyBackup');
    initDailyReportJob();
    initWeeklyBackupJob();

    // Initialize Telegram Listener
    const { initTelegramListener } = require('./utils/telegramListener');
    const { initCronJobs } = require('./utils/cronJobs');
    initTelegramListener(io);
    initCronJobs();
    
    // Auto-create default admin if no users exist (prevents lockout after DB clear)
    try {
      const User = require('./models/User');
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123!';
        await User.create({
          name: 'Super Admin',
          username: defaultUsername,
          password: defaultPassword,
          role: 'superadmin',
          permissions: ['manage_products', 'manage_orders', 'manage_customers', 'manage_returns', 'manage_finances']
        });
        console.log(`✅ Default superadmin yaratildi: ${defaultUsername} / [ENV: DEFAULT_ADMIN_PASSWORD]`);
      }
    } catch (err) {
      console.error('Error auto-creating admin:', err.message);
    }

    // Start server only after DB and Telegram bot are ready
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Socket.io Connection & Authentication Middleware
const jwt = require('jsonwebtoken');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type && decoded.type !== 'access') {
      return next(new Error('Authentication error: Invalid token type'));
    }
    const User = require('./models/User');
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return next(new Error('Authentication error: User not found or inactive'));
    }
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
});

io.on('connection', (socket) => {
  console.log('Client connected authenticated:', socket.user.username, socket.id);
  
  socket.on('join', (room) => {
    // RBAC: Check if user is allowed to join this room
    if (socket.user.role !== 'superadmin' && socket.user.role !== 'admin') {
      const allowedRoom = socket.user.warehouse ? socket.user.warehouse.toString() : null;
      if (room !== allowedRoom) {
        console.log(`Socket ${socket.id} access denied to room: ${room}`);
        return;
      }
    }
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  // ✅ NEW: Admin va superadminlar 'global_admins' room'iga avtomatik join
  // Bu room low stock, muhim alertlar uchun ishlatiladi
  if (socket.user.role === 'superadmin' || socket.user.role === 'admin') {
    socket.join('global_admins');
    console.log(`Socket ${socket.id} joined global_admins room (${socket.user.role})`);
  }

  socket.on('join_all_warehouses', async () => {
    try {
      if (socket.user.role !== 'superadmin' && socket.user.role !== 'admin') {
        console.log(`Socket ${socket.id} access denied to join_all_warehouses`);
        return;
      }
      const Warehouse = require('./models/Warehouse');
      const warehouses = await Warehouse.find({}, '_id');
      warehouses.forEach(w => socket.join(w._id.toString()));
      console.log(`Socket ${socket.id} joined all warehouse rooms (${warehouses.length})`);
    } catch (err) {
      console.error('Error joining all warehouses:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── Socket.IO Perioodik Token Re-validation ─────────────────────────────────
// Har 5 daqiqada barcha socket sessiyalarini tekshirish.
// Xodim ishdan chiqarilsa (isActive: false) yoki token muddati tugasa —
// socket avtomatik uziladi. HTTP API allaqachon himoyalangan.
const SOCKET_TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 daqiqa

setInterval(async () => {
  try {
    const User = require('./models/User');
    const sockets = await io.fetchSockets();

    for (const s of sockets) {
      try {
        // Token yanada tekshirish (muddati o'tganligini qayta sinab)
        const handshakeToken = s.handshake?.auth?.token || s.handshake?.query?.token;
        if (handshakeToken) {
          jwt.verify(handshakeToken, process.env.JWT_SECRET);
        }

        // Foydalanuvchi holati DB dan tekshirish
        if (s.user?._id) {
          const freshUser = await User.findById(s.user._id).select('isActive').lean();
          if (!freshUser || !freshUser.isActive) {
            console.log(`🔒 Socket majburan uzildi (bloklangan foydalanuvchi): ${s.user.username}`);
            s.disconnect(true);
          }
        }
      } catch (tokenErr) {
        // Token muddati o'tgan yoki yaroqsiz — socket uziladi
        console.log(`🔒 Socket majburan uzildi (token yaroqsiz): ${s.id}`);
        s.emit('auth:expired', { message: "Sessiya muddati tugadi. Qayta kiring." });
        s.disconnect(true);
      }
    }
  } catch (err) {
    console.error('Socket re-validation xatosi:', err.message);
  }
}, SOCKET_TOKEN_CHECK_INTERVAL);

// Basic Route
app.get('/', (req, res) => {
  res.send('Wallpaper CRM API is running');
});

// Ping Route for Uptime Services
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// Routes will be imported here
const warehouseRoutes = require('./routes/warehouses');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const aiRoutes = require('./routes/ai');
const exportRoutes = require('./routes/export');
const returnRoutes = require('./routes/returnRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const telegramSubscriberRoutes = require('./routes/telegramSubscriberRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const transferRoutes = require('./routes/transfers');
const pushRoutes = require('./routes/pushRoutes');
const systemRoutes = require('./routes/systemRoutes');
const { protect, authorize } = require('./middleware/authMiddleware');

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 10, // Maksimum 10 ta urinish
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Juda ko\'p urinish. 15 daqiqadan so\'ng qayta urinib ko\'ring.' },
  skipSuccessfulRequests: true, // Muvaffaqiyatli loginlarni sanama
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Juda ko\'p so\'rovlar. Biroz kuting.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/warehouses', protect, warehouseRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/customers', protect, customerRoutes);
app.use('/api/orders', protect, orderRoutes);
app.use('/api/payments', protect, paymentRoutes);
app.use('/api/ai', protect, aiRoutes);
app.use('/api/export', protect, exportRoutes);
app.use('/api/returns', protect, returnRoutes);
app.use('/api/settings', protect, settingsRoutes);
app.use('/api/telegram-subscribers', telegramSubscriberRoutes);
app.use('/api/shifts', protect, shiftRoutes);
app.use('/api/reports', protect, reportRoutes);
app.use('/api/transfers', protect, transferRoutes);
app.use('/api/users', protect, userRoutes);
app.use('/api/audit-logs', protect, auditLogRoutes);
app.use('/api/push', protect, pushRoutes);
app.use('/api/system', systemRoutes);

// ─── Telegram Webhook Route ──────────────────────────────────────────────────
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    // ✅ FIX: Telegram webhook secret token autentifikatsiyasi
    // Production'da TELEGRAM_WEBHOOK_SECRET .env da o'rnatilishi kerak
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (receivedSecret !== webhookSecret) {
        console.warn(`[Telegram Webhook] Noto'g'ri secret token: ${req.ip}`);
        return res.sendStatus(401);
      }
    }

    const { getBotInstance } = require('./utils/telegramListener');
    const bot = getBotInstance();
    if (bot) {
      bot.processUpdate(req.body);
      return res.sendStatus(200);
    } else {
      return res.sendStatus(503); // Service Unavailable - Tell Telegram to retry
    }
  } catch(e) {
    console.error(e);
    return res.sendStatus(500);
  }
});




// Error Handling Middleware
app.use(errorHandler);

// Handle unhandled promise rejections (Log only, don't crash the server for things like Telegram message failures)
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 (Not shutting down)');
  console.error(err.name, err.message);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});
