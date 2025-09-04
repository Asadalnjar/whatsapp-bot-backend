// models/AdminSettings.js
const mongoose = require("mongoose");

const adminSettingsSchema = new mongoose.Schema(
  {
    // كلمات محظورة على مستوى النظام
    bannedWords: {
      type: [String],
      default: []
    },

    // خيارات الحماية العامة
    autoKickEnabled: {
      type: Boolean,
      default: true
    },
    autoReplyEnabled: {
      type: Boolean,
      default: true
    },

    // ✅ صاحب البوت (يُحدّث تلقائياً عند أول اتصال بعد مسح الـQR)
    // خزّن الرقم أرقام فقط بدون + (مثال: 9677XXXXXXXX)
    ownerNumber: {
      type: String,
      default: ""
    },

    // ✅ أرقام مستثناة إضافية (قائمة بيضاء) - أرقام فقط
    whitelistNumbers: {
      type: [String],
      default: []
    },

    // إعدادات الدعم
    supportEmail: {
      type: String,
      default: ""
    },
    supportPhone: {
      type: String,
      default: ""
    },

    // مفاتيح وخدمات أخرى
    openAiKey: {
      type: String,
      default: ""
    },
    paypalClientId: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

const AdminSettings = mongoose.model("AdminSettings", adminSettingsSchema);
module.exports = AdminSettings;
