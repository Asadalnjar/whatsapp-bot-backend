// models/ModerationLog.js
const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema(
  {
    // ربط بالمستخدم (مالك البوت)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // معرف القروب
    groupId: {
      type: String,
      required: true,
      index: true
    },

    // اسم القروب
    groupName: {
      type: String,
      default: ''
    },

    // معلومات الرسالة
    messageMeta: {
      // معرف الرسالة
      messageId: {
        type: String,
        default: ''
      },
      
      // نص الرسالة
      content: {
        type: String,
        default: ''
      },
      
      // نوع الرسالة
      type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'other'],
        default: 'text'
      },
      
      // معرف المرسل
      senderId: {
        type: String,
        default: ''
      },
      
      // اسم المرسل
      senderName: {
        type: String,
        default: ''
      },
      
      // رقم المرسل
      senderPhone: {
        type: String,
        default: ''
      },
      
      // تاريخ الرسالة الأصلية
      timestamp: {
        type: Date,
        default: Date.now
      }
    },

    // الإجراء المتخذ
    action: {
      type: String,
      enum: ['delete', 'warn', 'kick', 'ban', 'mute'],
      required: true,
      index: true
    },

    // سبب الإجراء
    reason: {
      type: String,
      required: true,
      maxlength: 500
    },

    // الكلمة المحظورة التي تم كشفها (إن وجدت)
    detectedWord: {
      type: String,
      default: ''
    },

    // نوع المخالفة
    violationType: {
      type: String,
      enum: ['banned_word', 'spam', 'link', 'inappropriate_content', 'manual', 'other'],
      default: 'banned_word',
      index: true
    },

    // مستوى الشدة
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },

    // حالة الإجراء
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reverted'],
      default: 'completed',
      index: true
    },

    // تفاصيل إضافية
    details: {
      // هل تم تنفيذ الإجراء تلقائياً
      automated: {
        type: Boolean,
        default: true
      },
      
      // معرف القاعدة التي تم تطبيقها
      ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BannedWord',
        default: null
      },
      
      // معلومات إضافية
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },

    // ملاحظات إضافية
    notes: {
      type: String,
      default: '',
      maxlength: 1000
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// فهرسة مركبة للبحث السريع
moderationLogSchema.index({ userId: 1, groupId: 1, createdAt: -1 });
moderationLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
moderationLogSchema.index({ userId: 1, violationType: 1, createdAt: -1 });
moderationLogSchema.index({ groupId: 1, createdAt: -1 });

// Virtual للحصول على تاريخ مُنسق
moderationLogSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// دالة لتحديث حالة الإجراء
moderationLogSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  if (notes) this.notes = notes;
  return this.save();
};

// Static method لإنشاء سجل جديد
moderationLogSchema.statics.createLog = function(data) {
  return this.create({
    userId: data.userId,
    groupId: data.groupId,
    groupName: data.groupName || '',
    messageMeta: data.messageMeta || {},
    action: data.action,
    reason: data.reason,
    detectedWord: data.detectedWord || '',
    violationType: data.violationType || 'banned_word',
    severity: data.severity || 'medium',
    details: data.details || {},
    notes: data.notes || ''
  });
};

// Static method للحصول على إحصائيات المراقبة
moderationLogSchema.statics.getStats = function(userId, dateRange = {}) {
  const matchQuery = { userId: mongoose.Types.ObjectId(userId) };
  
  if (dateRange.from || dateRange.to) {
    matchQuery.createdAt = {};
    if (dateRange.from) matchQuery.createdAt.$gte = new Date(dateRange.from);
    if (dateRange.to) matchQuery.createdAt.$lte = new Date(dateRange.to);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        byAction: {
          $push: {
            action: '$action',
            count: 1
          }
        },
        byViolationType: {
          $push: {
            type: '$violationType',
            count: 1
          }
        },
        bySeverity: {
          $push: {
            severity: '$severity',
            count: 1
          }
        },
        byGroup: {
          $push: {
            groupId: '$groupId',
            groupName: '$groupName',
            count: 1
          }
        }
      }
    }
  ]);
};

// Static method للبحث مع فلاتر
moderationLogSchema.statics.findWithFilters = function(filters = {}) {
  const query = {};
  
  if (filters.userId) query.userId = filters.userId;
  if (filters.groupId) query.groupId = filters.groupId;
  if (filters.action) query.action = filters.action;
  if (filters.violationType) query.violationType = filters.violationType;
  if (filters.severity) query.severity = filters.severity;
  
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100)
    .skip(filters.skip || 0);
};

const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);

module.exports = ModerationLog;
