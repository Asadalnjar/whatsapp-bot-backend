// middleware/performance.js
// تحسين الأداء والسرعة

const compression = require('compression');

// Middleware للضغط
const compressionMiddleware = compression({
  level: 6, // مستوى الضغط (1-9)
  threshold: 1024, // ضغط الملفات أكبر من 1KB
  filter: (req, res) => {
    // لا تضغط إذا كان هناك header يمنع ذلك
    if (req.headers['x-no-compression']) {
      return false;
    }
    // ضغط جميع الاستجابات الأخرى
    return compression.filter(req, res);
  }
});

// Middleware لتحسين Headers
const optimizeHeaders = (req, res, next) => {
  // إضافة headers للتحكم في Cache
  if (req.method === 'GET') {
    // Cache للملفات الثابتة
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // سنة واحدة
    } else {
      // Cache قصير للـ API
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }

  // إضافة headers للأمان والأداء
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

// Middleware لمراقبة الأداء
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // تسجيل الطلبات البطيئة (أكثر من 1 ثانية)
    if (duration > 1000) {
      console.warn(`⚠️ طلب بطيء: ${req.method} ${req.url} - ${duration}ms`);
    }
    
    // تسجيل معلومات الأداء في development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${req.method} ${req.url} - ${duration}ms - ${res.statusCode}`);
    }
  });
  
  next();
};

// Middleware لتحديد حجم الطلب
const requestSizeLimit = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'حجم الطلب كبير جداً'
    });
  }
  
  next();
};

// Middleware لتنظيف الذاكرة
const memoryCleanup = (req, res, next) => {
  // تنظيف الذاكرة كل 100 طلب
  if (Math.random() < 0.01) { // 1% من الطلبات
    if (global.gc) {
      global.gc();
      console.log('🧹 تم تنظيف الذاكرة');
    }
  }
  
  next();
};

// دالة لمراقبة استخدام الذاكرة
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  const usage = {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
  
  console.log(`💾 استخدام الذاكرة: RSS: ${usage.rss}MB, Heap: ${usage.heapUsed}/${usage.heapTotal}MB, External: ${usage.external}MB`);
  
  // تحذير إذا كان استخدام الذاكرة عالي
  if (usage.heapUsed > 200) { // أكثر من 200MB
    console.warn('⚠️ استخدام ذاكرة عالي!');
  }
};

// مراقبة الذاكرة كل 5 دقائق
if (process.env.NODE_ENV === 'production') {
  setInterval(logMemoryUsage, 5 * 60 * 1000);
}

module.exports = {
  compressionMiddleware,
  optimizeHeaders,
  performanceMonitor,
  requestSizeLimit,
  memoryCleanup,
  logMemoryUsage
};
