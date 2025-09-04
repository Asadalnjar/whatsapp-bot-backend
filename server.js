// server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { sanitizeInput, validateDataSize } = require('./middleware/validation');
const {
  generalLimiter,
  speedLimiter,
  securityHeaders,
  validateUserAgent,
  validateIP,
  logSuspiciousActivity,
  preventHPP
} = require('./middleware/security');
const {
  compressionMiddleware,
  optimizeHeaders,
  performanceMonitor,
  requestSizeLimit,
  memoryCleanup
} = require("./middleware/performance");
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// ==========================
// 📌 استيراد المسارات
// ==========================
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const userGroupRoutes = require('./routes/userGroupRoutes'); // ✅

let waRoutes;
try {
  waRoutes = require('./routes/waRoutes');
} catch {
  waRoutes = null;
}

// ==========================
// 📌 إعداد CORS
// ==========================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  'https://your-frontend.com',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // أدوات مثل Postman/curl ترسل origin = undefined
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV === 'development') return callback(null, true); // تسهيل التطوير
    return callback(new Error('🚫 الوصول مرفوض بواسطة CORS'));
  },
  credentials: true,
};

// ==========================
// 📌 Middlewares الأداء والحماية
// ==========================
app.set('trust proxy', 1); // مهم عند التشغيل خلف Proxy/Render/Nginx

// تحسين الأداء
app.use(compressionMiddleware);
app.use(optimizeHeaders);
app.use(performanceMonitor);
app.use(requestSizeLimit);
app.use(memoryCleanup);

app.use(cors(corsOptions));

// CSP (اختياري)
const enableCsp = String(process.env.ENABLE_CSP || '').toLowerCase() === 'true';
const cspDirectives = enableCsp
  ? {
      useDefaults: true,
      directives: {
        connectSrc: [
          "'self'",
          ...allowedOrigins,
          ...allowedOrigins.map((o) =>
            o.startsWith('https://') ? o.replace('https://', 'wss://') :
            o.startsWith('http://') ? o.replace('http://', 'ws://') : o
          ),
        ],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    }
  : false;

// استخدام الأمان المحسن
app.use(securityHeaders);

// Security middleware
app.use(validateUserAgent);
app.use(validateIP);
app.use(logSuspiciousActivity);
app.use(preventHPP);

// Rate limiting
app.use(generalLimiter);
app.use(speedLimiter);

// Data validation and sanitization
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(sanitizeInput);
app.use(validateDataSize('2mb'));

// 📌 مسار صحي
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// 📌 معالجة favicon أثناء التطوير (لتفادي 404 مزعجة)
app.get('/favicon.ico', (_req, res) => res.sendStatus(204));

// 📌 عرض الملفات المرفوعة
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true,
    immutable: false,
  })
);

// ==========================
// 📌 Rate Limiting
// ==========================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth', apiLimiter);
app.use('/user', apiLimiter);
app.use('/admin', apiLimiter);
app.use('/wa', apiLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: '🚫 عدد محاولات تسجيل الدخول تجاوز الحد المسموح' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/login', loginLimiter);

// ==========================
// 📌 Socket.IO
// ==========================
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ['websocket', 'polling'],
  allowEIO3: false,
});

// ✅ توثيق Socket.IO عبر JWT
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.warn('WS: no token in handshake.auth');
      return next(new Error('no token'));
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { _id: payload.id, role: payload.role };
    return next();
  } catch (e) {
    console.warn('WS auth failed:', e?.message);
    return next(new Error('auth failed'));
  }
});

io.on('connection', (socket) => {
  try {
    if (socket.user?._id) socket.join(`user:${socket.user._id}`);
    if (socket.user?.role === 'admin') socket.join('admins');
  } catch (_) {}

  socket.on('disconnect', () => {
    // اختياري: تنظيف موارد
  });
});

// (اختياري) تهيئة خدمة واتساب
try {
  const { init: initWa } = require('./services/waService');
  if (typeof initWa === 'function') initWa(io);
} catch {
  // يمكن تفعيلها لاحقًا
}

// ==========================
// 📌 Routes
// ==========================
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);
app.use('/user', userGroupRoutes); // ✅ إدارة القروبات من DB
app.use('/user', require('./routes/groupExceptionRoutes')); // ✅ إدارة استثناءات القروبات
app.use('/user', require('./routes/violationRoutes')); // ✅ إدارة المخالفات

// ✅ Route عام لطلبات الاشتراك (بدون authentication)
const { createSubscriptionRequest } = require('./controllers/subscriptionRequestController');
app.post('/subscription-requests', createSubscriptionRequest);

if (waRoutes) app.use('/wa', waRoutes);

// ==========================
// 📌 معالِج أخطاء CORS
// ==========================
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, message: err.message });
  }
  return next(err);
});

// ==========================
// 📌 اتصال قاعدة البيانات + تشغيل السيرفر
// ==========================
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    server.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });
