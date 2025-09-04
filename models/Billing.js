// models/Billing.js
const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    plan: {
      type: String,
      enum: ["شهري", "سنوي"],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    method: {
      type: String,
      enum: ["تحويل بنكي", "PayPal", "Visa", "MasterCard"],
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["معلقة", "ناجحة", "فشلت", "مرفوض"], // ✅ أضفنا "مرفوض" هنا
      default: "معلقة"
    },
    startDate: Date,
    endDate: Date,
    proofFile: String
  },
  { timestamps: true }
);

const Billing = mongoose.model("Billing", billingSchema);
module.exports = Billing;
