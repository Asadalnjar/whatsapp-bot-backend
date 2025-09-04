const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1️⃣ تعريف الـ Schema (هيكل المستخدم في قاعدة البيانات)
const userSchema = new mongoose.Schema(
  {
    // الاسم الكامل
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true,
      minlength: [3, 'الاسم يجب أن يكون 3 أحرف على الأقل']
    },

    // البريد الإلكتروني (اختياري لكن فريد إذا أُدخل)
    email: {
      type: String,
      unique: true,
      sparse: true, // يسمح بأكثر من null
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'صيغة البريد الإلكتروني غير صحيحة']
    },

    // رقم الجوال (فريد وإلزامي)
    phone: {
      type: String,
      required: [true, 'رقم الجوال مطلوب'],
      unique: true,
      trim: true
    },

    // كلمة المرور (مشفرة لاحقًا)
    password: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة'],
      minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
    },

    // الدور (افتراضي user)
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },

    // حالة الحساب (مبسطة - الحالة التفصيلية في Subscription)
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'banned'],
      default: 'pending'
    },

    // معلومات إضافية
    profile: {
      avatar: { type: String, default: '' },
      bio: { type: String, default: '', maxlength: 500 },
      timezone: { type: String, default: 'Asia/Riyadh' },
      language: { type: String, default: 'ar', enum: ['ar', 'en'] }
    },

    // إعدادات الإشعارات
    notificationSettings: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },

    // معلومات الأمان
    security: {
      lastLoginAt: { type: Date, default: null },
      lastLoginIP: { type: String, default: '' },
      loginAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      passwordChangedAt: { type: Date, default: Date.now },
      twoFactorEnabled: { type: Boolean, default: false }
    },

    // إحصائيات
    stats: {
      totalLogins: { type: Number, default: 0 },
      totalSubscriptions: { type: Number, default: 0 },
      totalViolations: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true // يضيف createdAt و updatedAt تلقائيًا
  }
);

// ✅ ميدل وير لتوحيد صيغة رقم الهاتف قبل الحفظ
userSchema.pre('save', function (next) {
  if (this.isModified('phone') || this.isNew) {
    let phone = this.phone.replace(/\s+/g, '').trim(); // إزالة أي مسافات

    // صيغة محلية يمنية (77xxxxxxxx)
    if (/^7\d{8,9}$/.test(phone)) {
      phone = `+967${phone}`;
    }
    // صيغة محلية سعودية (05xxxxxxxx)
    else if (/^05\d{8}$/.test(phone)) {
      phone = `+966${phone.substring(1)}`;
    }
    // صيغة دولية يمنية صحيحة
    else if (/^\+9677\d{8,9}$/.test(phone)) {
      phone = phone;
    }
    // صيغة دولية سعودية صحيحة
    else if (/^\+9665\d{8}$/.test(phone)) {
      phone = phone;
    }
    else {
      return next(
        new Error('صيغة رقم الجوال غير صحيحة (يجب أن يكون رقم يمني أو سعودي)')
      );
    }

    this.phone = phone;
  }
  next();
});

// 2️⃣ Middleware قبل حفظ المستخدم → تشفير كلمة المرور إذا كانت جديدة
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // إذا لم تتغير كلمة المرور لا نعيد التشفير

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // إذا تم تغيير كلمة المرور، قم بإبطال جميع الجلسات النشطة
  if (!this.isNew) {
    this._passwordChanged = true;
  }

  next();
});

// Middleware بعد الحفظ لإبطال الجلسات عند تغيير كلمة المرور
userSchema.post('save', async function(doc) {
  if (doc._passwordChanged) {
    try {
      // استيراد sessionService بشكل ديناميكي لتجنب circular dependency
      const sessionService = require('../services/sessionService');
      await sessionService.revokeAllUserSessions(doc._id, 'password_change');
      console.log(`🔒 تم إبطال جميع جلسات المستخدم ${doc._id} بسبب تغيير كلمة المرور`);
    } catch (error) {
      console.error('❌ خطأ في إبطال الجلسات بعد تغيير كلمة المرور:', error);
    }
  }
});

// 3️⃣ إضافة دالة للتحقق من كلمة المرور (عند تسجيل الدخول)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// فهرسة إضافية للبحث السريع
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ role: 1, status: 1 });

// Virtual للتحقق من قفل الحساب
userSchema.virtual('isLocked').get(function() {
  return this.security.lockedUntil && this.security.lockedUntil > Date.now();
});

// Virtual للحصول على الاسم المختصر
userSchema.virtual('shortName').get(function() {
  return this.name.split(' ')[0];
});

// دالة لتسجيل محاولة دخول ناجحة
userSchema.methods.recordSuccessfulLogin = function(ip = '') {
  this.security.lastLoginAt = new Date();
  this.security.lastLoginIP = ip;
  this.security.loginAttempts = 0;
  this.security.lockedUntil = null;
  this.stats.totalLogins += 1;
  return this.save();
};

// دالة لتسجيل محاولة دخول فاشلة
userSchema.methods.recordFailedLogin = function() {
  this.security.loginAttempts += 1;

  // قفل الحساب بعد 5 محاولات فاشلة لمدة 30 دقيقة
  if (this.security.loginAttempts >= 5) {
    this.security.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }

  return this.save();
};

// دالة لتحديث كلمة المرور
userSchema.methods.updatePassword = function(newPassword) {
  this.password = newPassword;
  this.security.passwordChangedAt = new Date();
  return this.save();
};

// دالة لتفعيل الحساب
userSchema.methods.activate = function() {
  this.status = 'active';
  return this.save();
};

// دالة لتعليق الحساب
userSchema.methods.suspend = function(reason = '') {
  this.status = 'suspended';
  return this.save();
};

// Static method للبحث عن المستخدمين النشطين
userSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method للبحث عن المستخدمين المعلقين
userSchema.statics.findSuspended = function() {
  return this.find({ status: 'suspended' });
};

// Static method للبحث عن المستخدمين بالدور
userSchema.statics.findByRole = function(role) {
  return this.find({ role: role });
};

// 4️⃣ إنشاء الموديل
const User = mongoose.model('User', userSchema);

module.exports = User;
