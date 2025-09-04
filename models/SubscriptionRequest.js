// models/SubscriptionRequest.js
const mongoose = require("mongoose");

const subscriptionRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      match: [/^05\d{8}$/, "صيغة رقم الجوال غير صحيحة"]
    },
    plan: {
      type: String,
      enum: ["شهري", "سنوي"],
      required: true
    },
    amount: {
      type: Number,
      required: false // المبلغ ليس إجباري هنا، ممكن نحسبه لاحقًا
    },
    method: {
      type: String,
      enum: ["تحويل بنكي", "Visa", "MasterCard", "PayPal"],
      default: "تحويل بنكي",
      required: true
    },
    proofFile: {
      type: String, // مسار ملف إيصال الدفع
      default: ""
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["قيد المراجعة", "موافق عليه", "مرفوض"],
      default: "قيد المراجعة"
    }
  },
  { timestamps: true }
);

const SubscriptionRequest = mongoose.model(
  "SubscriptionRequest",
  subscriptionRequestSchema
);

module.exports = SubscriptionRequest;
