// models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    // ربط بالاشتراك
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true
    },

    // ربط بالمستخدم (للبحث السريع)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // رقم الفاتورة (تلقائي)
    invoiceNumber: {
      type: String,
      unique: true,
      required: true
    },

    // المبلغ
    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // العملة
    currency: {
      type: String,
      default: 'SAR',
      enum: ['SAR', 'USD', 'YER']
    },

    // طريقة الدفع
    method: {
      type: String,
      enum: ['تحويل بنكي', 'Visa', 'MasterCard', 'PayPal', 'STC Pay', 'أخرى'],
      required: true
    },

    // مرجع الدفع (رقم العملية)
    reference: {
      type: String,
      default: ''
    },

    // حالة الفاتورة
    status: {
      type: String,
      enum: [
        'uploaded',    // تم رفع إثبات الدفع
        'pending',     // بانتظار المراجعة
        'accepted',    // مقبولة
        'rejected',    // مرفوضة
        'expired'      // منتهية الصلاحية
      ],
      default: 'pending',
      index: true
    },

    // ملف إثبات الدفع
    fileUrl: {
      type: String,
      default: ''
    },

    // نوع الملف
    fileType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
      default: 'image/jpeg'
    },

    // حجم الملف (بالبايت)
    fileSize: {
      type: Number,
      default: 0
    },

    // تاريخ الاستحقاق
    dueDate: {
      type: Date,
      required: true,
      index: true
    },

    // تاريخ الدفع الفعلي
    paidAt: {
      type: Date,
      default: null
    },

    // تاريخ المراجعة
    reviewedAt: {
      type: Date,
      default: null
    },

    // المراجع (المشرف الذي راجع)
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // سبب الرفض (إن وجد)
    rejectionReason: {
      type: String,
      default: '',
      maxlength: 500
    },

    // ملاحظات إضافية
    notes: {
      type: String,
      default: '',
      maxlength: 1000
    },

    // معلومات إضافية للدفع
    paymentDetails: {
      bankName: {
        type: String,
        default: ''
      },
      accountNumber: {
        type: String,
        default: ''
      },
      transactionId: {
        type: String,
        default: ''
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// فهرسة مركبة للبحث السريع
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ subscriptionId: 1, createdAt: -1 });

// Virtual للتحقق من انتهاء صلاحية الفاتورة
invoiceSchema.virtual('isOverdue').get(function() {
  return new Date() > this.dueDate && this.status === 'pending';
});

// Pre-save middleware لتوليد رقم الفاتورة
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// دالة لقبول الفاتورة
invoiceSchema.methods.accept = function(reviewerId) {
  this.status = 'accepted';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.paidAt = new Date();
  return this.save();
};

// دالة لرفض الفاتورة
invoiceSchema.methods.reject = function(reviewerId, reason = '') {
  this.status = 'rejected';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  this.rejectionReason = reason;
  return this.save();
};

// Static method للبحث عن الفواتير المتأخرة
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    status: 'pending',
    dueDate: { $lt: new Date() }
  });
};

// Static method للبحث عن الفواتير المعلقة
invoiceSchema.statics.findPending = function() {
  return this.find({
    status: { $in: ['uploaded', 'pending'] }
  }).populate('userId', 'name phone email')
    .populate('subscriptionId', 'plan status');
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
