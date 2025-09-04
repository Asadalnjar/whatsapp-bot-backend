// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    // ربط بالمستخدم
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // نوع الباقة
    plan: {
      type: String,
      enum: ['شهري', 'فصلي', 'سنوي'],
      required: true
    },

    // حالة الاشتراك
    status: {
      type: String,
      enum: [
        'new',           // جديد
        'pending_payment', // بانتظار الدفع
        'under_review',   // تحت المراجعة
        'approved',       // موافق عليه
        'active',         // نشط
        'suspended',      // موقوف
        'expired'         // منتهي الصلاحية
      ],
      default: 'new',
      index: true
    },

    // تاريخ البداية
    startedAt: {
      type: Date,
      default: null
    },

    // تاريخ انتهاء الصلاحية
    expiresAt: {
      type: Date,
      default: null
    },

    // المبلغ المدفوع
    amount: {
      type: Number,
      required: false,
      min: 0
    },

    // العملة
    currency: {
      type: String,
      default: 'SAR',
      enum: ['SAR', 'USD', 'YER']
    },

    // ملاحظات إضافية
    notes: {
      type: String,
      default: '',
      maxlength: 500
    },

    // معلومات الدفع
    paymentInfo: {
      method: {
        type: String,
        enum: ['تحويل بنكي', 'Visa', 'MasterCard', 'PayPal', 'STC Pay', 'أخرى'],
        default: 'تحويل بنكي'
      },
      reference: {
        type: String,
        default: ''
      },
      paidAt: {
        type: Date,
        default: null
      }
    },

    // تاريخ آخر تجديد
    lastRenewalAt: {
      type: Date,
      default: null
    },

    // عدد مرات التجديد
    renewalCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// فهرسة مركبة للبحث السريع
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, expiresAt: 1 });

// Virtual للتحقق من انتهاء الصلاحية
subscriptionSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual للتحقق من قرب انتهاء الصلاحية (7 أيام)
subscriptionSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiresAt) return false;
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return this.expiresAt <= sevenDaysFromNow;
});

// دالة لحساب تاريخ انتهاء الصلاحية حسب نوع الباقة
subscriptionSchema.methods.calculateExpiryDate = function(startDate = new Date()) {
  const start = new Date(startDate);
  
  switch (this.plan) {
    case 'شهري':
      start.setMonth(start.getMonth() + 1);
      break;
    case 'فصلي':
      start.setMonth(start.getMonth() + 3);
      break;
    case 'سنوي':
      start.setFullYear(start.getFullYear() + 1);
      break;
    default:
      start.setMonth(start.getMonth() + 1); // افتراضي شهري
  }
  
  return start;
};

// دالة لتفعيل الاشتراك
subscriptionSchema.methods.activate = function() {
  this.status = 'active';
  this.startedAt = new Date();
  this.expiresAt = this.calculateExpiryDate(this.startedAt);
  return this.save();
};

// دالة لتعليق الاشتراك
subscriptionSchema.methods.suspend = function(reason = '') {
  this.status = 'suspended';
  if (reason) this.notes = reason;
  return this.save();
};

// دالة للتجديد
subscriptionSchema.methods.renew = function() {
  this.status = 'active';
  this.lastRenewalAt = new Date();
  this.renewalCount += 1;
  this.expiresAt = this.calculateExpiryDate();
  return this.save();
};

// Static method للبحث عن الاشتراكات المنتهية الصلاحية
subscriptionSchema.statics.findExpired = function() {
  return this.find({
    status: 'active',
    expiresAt: { $lt: new Date() }
  });
};

// Static method للبحث عن الاشتراكات التي ستنتهي قريباً
subscriptionSchema.statics.findExpiringSoon = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    expiresAt: { $lte: futureDate, $gt: new Date() }
  });
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
