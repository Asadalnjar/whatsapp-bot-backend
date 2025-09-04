// models/WaSession.js
const mongoose = require("mongoose");

const waSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },

  // حالة الجلسة حسب المتطلبات الجديدة
  state: {
    type: String,
    enum: [
      "inactive",      // غير نشطة
      "qr_ready",      // جاهزة لعرض QR
      "connecting",    // جاري الاتصال
      "connected",     // متصلة
      "disconnected"   // منقطعة
    ],
    default: "inactive",
    index: true
  },

  // تخزين مفاتيح المصادقة (Baileys auth state) بشكل آمن
  auth: {
    creds: { type: Object, default: {} },
    keys: { type: Object, default: {} },
  },

  // آخر QR code تم توليده
  lastQr: { type: String, default: "" },     // base64

  // تاريخ آخر نشاط
  lastSeenAt: { type: Date, default: null },

  // معلومات الجهاز
  deviceInfo: {
    platform: { type: String, default: "" },
    version: { type: String, default: "" },
    browser: { type: String, default: "" }
  },

  // الكلمات المحظورة لهذا المستخدم
  bannedWords: [{
    type: String,
    trim: true
  }],

  // حالة تفعيل الحماية العامة
  protectionEnabled: {
    type: Boolean,
    default: false
  },

  // إعدادات الحماية
  protectionSettings: {
    autoKick: { type: Boolean, default: false },
    autoDelete: { type: Boolean, default: true },
    allowOwnerBypass: { type: Boolean, default: true },
    warningBeforeKick: { type: Boolean, default: false }
  },

  // إحصائيات
  stats: {
    messagesProcessed: { type: Number, default: 0 },
    violationsDetected: { type: Number, default: 0 },
    usersKicked: { type: Number, default: 0 },
    messagesDeleted: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  versionKey: false
});

// فهرسة للبحث السريع
waSessionSchema.index({ state: 1, lastSeenAt: -1 });

// Virtual للتحقق من حالة الاتصال
waSessionSchema.virtual('isActive').get(function() {
  return this.state === 'connected';
});

// Virtual للتحقق من انقطاع الاتصال لفترة طويلة
waSessionSchema.virtual('isStale').get(function() {
  if (!this.lastSeenAt) return true;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.lastSeenAt < oneHourAgo;
});

// دالة لتحديث حالة الجلسة
waSessionSchema.methods.updateState = function(newState) {
  this.state = newState;
  this.lastSeenAt = new Date();
  return this.save();
};

// دالة لإضافة كلمة محظورة
waSessionSchema.methods.addBannedWord = function(word) {
  if (!this.bannedWords.includes(word.toLowerCase())) {
    this.bannedWords.push(word.toLowerCase());
    return this.save();
  }
  return Promise.resolve(this);
};

// دالة لحذف كلمة محظورة
waSessionSchema.methods.removeBannedWord = function(word) {
  this.bannedWords = this.bannedWords.filter(w => w !== word.toLowerCase());
  return this.save();
};

// دالة للتحقق من وجود كلمة محظورة في النص
waSessionSchema.methods.containsBannedWord = function(text) {
  if (!this.protectionEnabled || !text) return false;

  const lowerText = text.toLowerCase();
  return this.bannedWords.some(word => lowerText.includes(word));
};

// دالة لتحديث الإحصائيات
waSessionSchema.methods.updateStats = function(type) {
  switch(type) {
    case 'message':
      this.stats.messagesProcessed += 1;
      break;
    case 'violation':
      this.stats.violationsDetected += 1;
      break;
    case 'kick':
      this.stats.usersKicked += 1;
      break;
    case 'delete':
      this.stats.messagesDeleted += 1;
      break;
  }
  return this.save();
};

// Static method للبحث عن الجلسات النشطة
waSessionSchema.statics.findActive = function() {
  return this.find({ state: 'connected' });
};

// Static method للبحث عن الجلسات المنقطعة
waSessionSchema.statics.findDisconnected = function() {
  return this.find({
    state: { $in: ['disconnected', 'inactive'] }
  });
};

module.exports = mongoose.model("WaSession", waSessionSchema);
