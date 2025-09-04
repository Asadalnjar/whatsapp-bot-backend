// models/BannedWord.js
const mongoose = require('mongoose');

const bannedWordSchema = new mongoose.Schema(
  {
    // ربط بالمستخدم
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // الكلمة المحظورة
    word: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 100
    },

    // نوع الحظر
    type: {
      type: String,
      enum: ['exact', 'contains', 'regex'],
      default: 'contains'
    },

    // مستوى الشدة
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },

    // الإجراء المطلوب
    action: {
      type: String,
      enum: ['delete', 'warn', 'kick', 'ban'],
      default: 'delete'
    },

    // حالة التفعيل
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    // عدد مرات الكشف
    detectionCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // آخر مرة تم كشفها
    lastDetectedAt: {
      type: Date,
      default: null
    },

    // ملاحظات
    notes: {
      type: String,
      default: '',
      maxlength: 500
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// فهرسة مركبة لمنع التكرار
bannedWordSchema.index({ userId: 1, word: 1 }, { unique: true });
bannedWordSchema.index({ userId: 1, isActive: 1 });

// دالة للتحقق من تطابق النص مع الكلمة المحظورة
bannedWordSchema.methods.matches = function(text) {
  if (!this.isActive || !text) return false;
  
  const lowerText = text.toLowerCase();
  
  switch (this.type) {
    case 'exact':
      return lowerText === this.word;
    case 'contains':
      return lowerText.includes(this.word);
    case 'regex':
      try {
        const regex = new RegExp(this.word, 'i');
        return regex.test(text);
      } catch (e) {
        return false;
      }
    default:
      return lowerText.includes(this.word);
  }
};

// دالة لتسجيل كشف الكلمة
bannedWordSchema.methods.recordDetection = function() {
  this.detectionCount += 1;
  this.lastDetectedAt = new Date();
  return this.save();
};

// دالة لتفعيل/إلغاء تفعيل الكلمة
bannedWordSchema.methods.toggle = function() {
  this.isActive = !this.isActive;
  return this.save();
};

// Static method للبحث عن الكلمات المحظورة النشطة لمستخدم
bannedWordSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    userId: userId,
    isActive: true
  }).sort({ severity: -1, createdAt: -1 });
};

// Static method للتحقق من النص ضد جميع الكلمات المحظورة للمستخدم
bannedWordSchema.statics.checkText = async function(userId, text) {
  const bannedWords = await this.findActiveByUser(userId);
  const violations = [];
  
  for (const bannedWord of bannedWords) {
    if (bannedWord.matches(text)) {
      violations.push({
        word: bannedWord.word,
        type: bannedWord.type,
        severity: bannedWord.severity,
        action: bannedWord.action,
        bannedWordId: bannedWord._id
      });
      
      // تسجيل الكشف
      await bannedWord.recordDetection();
    }
  }
  
  return violations;
};

// Static method للحصول على إحصائيات الكلمات المحظورة
bannedWordSchema.statics.getStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalWords: { $sum: 1 },
        activeWords: { $sum: { $cond: ['$isActive', 1, 0] } },
        totalDetections: { $sum: '$detectionCount' },
        bySeverity: {
          $push: {
            severity: '$severity',
            count: 1,
            detections: '$detectionCount'
          }
        }
      }
    }
  ]);
};

const BannedWord = mongoose.model('BannedWord', bannedWordSchema);

module.exports = BannedWord;
