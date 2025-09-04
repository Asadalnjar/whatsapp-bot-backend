// models/Violation.js
const mongoose = require("mongoose");

const ViolationSchema = new mongoose.Schema(
  {
    // معرف القروب
    groupJid: { type: String, index: true, required: true },

    // معرف المرسل (المستخدم في واتساب)
    userJid: { type: String, index: true, required: true },

    // عدد المخالفات
    count: { type: Number, default: 0, min: 0 },

    // آخر وقت تسجيل مخالفة
    lastAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ⚡️ فهرس مركّب لتسريع البحث
ViolationSchema.index({ groupJid: 1, userJid: 1 }, { unique: true });

/**
 * 📌 دالة ثابتة: تسجيل مخالفة وزيادة العداد
 * @param {string} groupJid 
 * @param {string} userJid 
 * @returns {Promise<Violation>}
 */
ViolationSchema.statics.recordViolation = async function (groupJid, userJid) {
  return this.findOneAndUpdate(
    { groupJid, userJid },
    { $inc: { count: 1 }, $set: { lastAt: new Date() } },
    { new: true, upsert: true }
  );
};

/**
 * 📌 دالة ثابتة: إعادة تعيين كل المخالفات لقروب معيّن
 */
ViolationSchema.statics.resetViolationsForGroup = async function (groupJid) {
  return this.deleteMany({ groupJid });
};

/**
 * 📌 دالة ثابتة: إعادة تعيين مخالفات مستخدم داخل قروب
 */
ViolationSchema.statics.resetViolationsForUser = async function (groupJid, userJid) {
  return this.deleteOne({ groupJid, userJid });
};

/**
 * 📌 ميثود: إعادة ضبط عدّاد المخالفات لهذا السجل
 */
ViolationSchema.methods.reset = function () {
  this.count = 0;
  this.lastAt = new Date();
  return this.save();
};

const Violation = mongoose.model("Violation", ViolationSchema);
module.exports = Violation;
