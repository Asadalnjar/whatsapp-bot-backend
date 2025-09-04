// models/UserSession.js
const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  // المستخدم المرتبط بالجلسة
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // معرف الجلسة الفريد
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Refresh Token المشفر
  refreshToken: {
    type: String,
    required: true,
    index: true
  },

  // معلومات الجهاز والمتصفح
  deviceInfo: {
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    device: { type: String, default: '' }
  },

  // معلومات الموقع (اختياري)
  location: {
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    timezone: { type: String, default: '' }
  },

  // حالة الجلسة
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'suspicious'],
    default: 'active',
    index: true
  },

  // تواريخ مهمة
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },

  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  // معلومات إضافية للأمان
  loginAttempts: {
    type: Number,
    default: 0
  },

  isSecure: {
    type: Boolean,
    default: false // true إذا كان الاتصال عبر HTTPS
  },

  // سبب إنهاء الجلسة (إن وجد)
  revokedReason: {
    type: String,
    enum: ['logout', 'password_change', 'admin_action', 'security_breach', 'timeout', 'suspicious_activity'],
    default: null
  },

  revokedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes للأداء
userSessionSchema.index({ userId: 1, status: 1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userSessionSchema.index({ lastActivity: 1 });
userSessionSchema.index({ createdAt: 1 });

// دالة لتحديث آخر نشاط
userSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// دالة لإبطال الجلسة
userSessionSchema.methods.revoke = function(reason = 'logout') {
  this.status = 'revoked';
  this.revokedReason = reason;
  this.revokedAt = new Date();
  return this.save();
};

// دالة للتحقق من انتهاء صلاحية الجلسة
userSessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt || this.status !== 'active';
};

// دالة للتحقق من الجلسة المشبوهة
userSessionSchema.methods.markSuspicious = function() {
  this.status = 'suspicious';
  return this.save();
};

// Static methods
userSessionSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    userId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

userSessionSchema.statics.revokeAllByUser = function(userId, reason = 'security') {
  return this.updateMany(
    { userId, status: 'active' },
    {
      status: 'revoked',
      revokedReason: reason,
      revokedAt: new Date()
    }
  );
};

userSessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { status: { $in: ['expired', 'revoked'] } }
    ]
  });
};

// تنظيف الجلسات المنتهية الصلاحية تلقائياً
userSessionSchema.statics.scheduleCleanup = function() {
  setInterval(async () => {
    try {
      const result = await this.cleanupExpired();
      if (result.deletedCount > 0) {
        console.log(`🧹 تم حذف ${result.deletedCount} جلسة منتهية الصلاحية`);
      }
    } catch (error) {
      console.error('❌ خطأ في تنظيف الجلسات:', error);
    }
  }, 60 * 60 * 1000); // كل ساعة
};

module.exports = mongoose.model('UserSession', userSessionSchema);
