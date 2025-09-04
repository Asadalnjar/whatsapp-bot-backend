// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // المستقبل
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // المرسل (اختياري - قد يكون النظام)
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // نوع الإشعار
    type: {
      type: String,
      enum: [
        'subscription_approved',    // تم قبول الاشتراك
        'subscription_rejected',    // تم رفض الاشتراك
        'subscription_expiring',    // الاشتراك سينتهي قريباً
        'subscription_expired',     // انتهى الاشتراك
        'invoice_uploaded',         // تم رفع فاتورة جديدة
        'invoice_accepted',         // تم قبول الفاتورة
        'invoice_rejected',         // تم رفض الفاتورة
        'session_connected',        // تم توصيل الجلسة
        'session_disconnected',     // انقطعت الجلسة
        'violation_detected',       // تم كشف مخالفة
        'system_maintenance',       // صيانة النظام
        'welcome',                  // ترحيب
        'general'                   // عام
      ],
      required: true,
      index: true
    },

    // العنوان
    title: {
      type: String,
      required: true,
      maxlength: 200
    },

    // المحتوى
    body: {
      type: String,
      required: true,
      maxlength: 1000
    },

    // بيانات إضافية (JSON)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // حالة القراءة
    read: {
      type: Boolean,
      default: false,
      index: true
    },

    // تاريخ القراءة
    readAt: {
      type: Date,
      default: null
    },

    // الأولوية
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true
    },

    // رابط الإجراء (اختياري)
    actionUrl: {
      type: String,
      default: ''
    },

    // نص زر الإجراء
    actionText: {
      type: String,
      default: ''
    },

    // تاريخ انتهاء الصلاحية (للإشعارات المؤقتة)
    expiresAt: {
      type: Date,
      default: null
    },

    // حالة الإشعار
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// فهرسة مركبة للبحث السريع
notificationSchema.index({ toUserId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ toUserId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ toUserId: 1, priority: 1, createdAt: -1 });

// Virtual للتحقق من انتهاء صلاحية الإشعار
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual للحصول على تاريخ مُنسق
notificationSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// دالة لتمييز الإشعار كمقروء
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// دالة لأرشفة الإشعار
notificationSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

// دالة لحذف الإشعار
notificationSchema.methods.softDelete = function() {
  this.status = 'deleted';
  return this.save();
};

// Static method لإنشاء إشعار جديد
notificationSchema.statics.createNotification = function(data) {
  return this.create({
    toUserId: data.toUserId,
    fromUserId: data.fromUserId || null,
    type: data.type,
    title: data.title,
    body: data.body,
    meta: data.meta || {},
    priority: data.priority || 'normal',
    actionUrl: data.actionUrl || '',
    actionText: data.actionText || '',
    expiresAt: data.expiresAt || null
  });
};

// Static method للحصول على الإشعارات غير المقروءة
notificationSchema.statics.getUnread = function(userId) {
  return this.find({
    toUserId: userId,
    read: false,
    status: 'active',
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ priority: -1, createdAt: -1 });
};

// Static method للحصول على عدد الإشعارات غير المقروءة
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    toUserId: userId,
    read: false,
    status: 'active',
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method لتمييز جميع الإشعارات كمقروءة
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    {
      toUserId: userId,
      read: false,
      status: 'active'
    },
    {
      read: true,
      readAt: new Date()
    }
  );
};

// Static method لحذف الإشعارات المنتهية الصلاحية
notificationSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      status: 'active'
    },
    {
      status: 'archived'
    }
  );
};

// Static method للحصول على إشعارات بفلاتر
notificationSchema.statics.findWithFilters = function(userId, filters = {}) {
  const query = {
    toUserId: userId,
    status: filters.status || 'active'
  };
  
  if (filters.type) query.type = filters.type;
  if (filters.read !== undefined) query.read = filters.read;
  if (filters.priority) query.priority = filters.priority;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 50)
    .skip(filters.skip || 0);
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
