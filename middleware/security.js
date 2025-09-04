// middleware/security.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Rate limiting للـ API العام
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // تخطي Rate limiting للمشرفين
    return req.user && req.user.role === 'admin';
  }
});

/**
 * Rate limiting صارم لتسجيل الدخول
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات فقط
  message: {
    success: false,
    message: 'تم تجاوز عدد محاولات تسجيل الدخول. حاول مرة أخرى بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // لا تحسب المحاولات الناجحة
});

/**
 * Rate limiting لتسجيل المستخدمين الجدد
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة بدلاً من ساعة
  max: 10, // 10 محاولات بدلاً من 3
  message: {
    success: false,
    message: 'تم تجاوز عدد محاولات التسجيل. حاول مرة أخرى بعد 15 دقيقة'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // لا تحسب المحاولات الناجحة
});

/**
 * Rate limiting لتغيير كلمة المرور
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  max: 3, // 3 محاولات فقط
  message: {
    success: false,
    message: 'تم تجاوز عدد محاولات تغيير كلمة المرور. حاول مرة أخرى بعد ساعة'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Slow down للطلبات المتكررة
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  delayAfter: 50, // بدء التأخير بعد 50 طلب
  delayMs: () => 500, // تأخير 500ms لكل طلب إضافي
  maxDelayMs: 20000, // حد أقصى 20 ثانية تأخير
  skip: (req) => {
    return req.user && req.user.role === 'admin';
  },
  validate: { delayMs: false } // تعطيل التحذير
});

/**
 * إعدادات Helmet للأمان
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // تعطيل لتجنب مشاكل مع Socket.IO
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CSRF Protection
 */
const csrfProtection = (req, res, next) => {
  // تخطي CSRF للـ GET requests
  if (req.method === 'GET') {
    return next();
  }

  // تخطي CSRF للـ API endpoints التي تستخدم JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // فحص CSRF token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token غير صحيح'
    });
  }

  next();
};

/**
 * إنشاء CSRF token
 */
const generateCSRFToken = (req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**
 * فحص User Agent للكشف عن البوتات المشبوهة
 */
const validateUserAgent = (req, res, next) => {
  const userAgent = req.headers['user-agent'];
  
  if (!userAgent) {
    return res.status(400).json({
      success: false,
      message: 'User Agent مطلوب'
    });
  }

  // قائمة بالـ User Agents المشبوهة
  const suspiciousAgents = [
    'curl',
    'wget',
    'python-requests',
    'postman',
    'insomnia',
    'bot',
    'crawler',
    'spider'
  ];

  const isSuspicious = suspiciousAgents.some(agent => 
    userAgent.toLowerCase().includes(agent)
  );

  if (isSuspicious) {
    console.warn(`⚠️ User Agent مشبوه: ${userAgent} من IP: ${req.ip}`);
    // يمكن إما رفض الطلب أو تسجيله فقط
    // return res.status(403).json({
    //   success: false,
    //   message: 'غير مسموح'
    // });
  }

  next();
};

/**
 * فحص الـ IP للكشف عن الـ VPN والـ Proxy
 */
const validateIP = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // قائمة بالـ IP ranges المشبوهة (يمكن توسيعها)
  const suspiciousRanges = [
    '10.0.0.0/8',     // Private network
    '172.16.0.0/12',  // Private network
    '192.168.0.0/16', // Private network
    '127.0.0.0/8'     // Localhost
  ];

  // فحص إذا كان الـ IP في النطاقات المشبوهة
  // (هذا مثال بسيط، يمكن استخدام مكتبات أكثر تطوراً)
  
  req.clientIP = ip;
  next();
};

/**
 * تسجيل الطلبات المشبوهة
 */
const logSuspiciousActivity = (req, res, next) => {
  const suspiciousIndicators = [];

  // فحص عدة مؤشرات مشبوهة
  if (!req.headers.referer && req.method === 'POST') {
    suspiciousIndicators.push('no_referer');
  }

  if (req.headers['x-forwarded-for']) {
    suspiciousIndicators.push('proxy_detected');
  }

  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.length < 10) {
    suspiciousIndicators.push('short_user_agent');
  }

  if (suspiciousIndicators.length > 0) {
    console.warn(`⚠️ نشاط مشبوه من ${req.ip}:`, {
      indicators: suspiciousIndicators,
      userAgent,
      path: req.path,
      method: req.method
    });
  }

  next();
};

/**
 * حماية من HTTP Parameter Pollution
 */
const preventHPP = (req, res, next) => {
  // تنظيف المعاملات المكررة
  for (const key in req.query) {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][req.query[key].length - 1];
    }
  }
  
  next();
};

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  passwordChangeLimiter,
  speedLimiter,
  securityHeaders,
  csrfProtection,
  generateCSRFToken,
  validateUserAgent,
  validateIP,
  logSuspiciousActivity,
  preventHPP
};
