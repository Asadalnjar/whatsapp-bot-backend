// models/Bot.js
const mongoose = require("mongoose");

const botSchema = new mongoose.Schema(
  {
    // المستخدم المرتبط بهذا البوت
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // رقم المستخدم
    userPhone: {
      type: String,
      required: true
    },

    // حالة الجلسة: متصل / بانتظار QR / متوقف
    status: {
      type: String,
      enum: ["متصل", "بانتظار QR", "متوقف"],
      default: "بانتظار QR"
    },

    // عدد الجروبات التي يديرها البوت
    groupsCount: {
      type: Number,
      default: 0
    },

    // آخر مرة كان فيها نشط
    lastSeen: {
      type: String,
      default: "غير متصل"
    }
  },
  { timestamps: true }
);

const Bot = mongoose.model("Bot", botSchema);
module.exports = Bot;
