// models/Group.js
// ==================
// تخزين معلومات قروبات واتساب لكل مستخدم مع الاعتماد على JID كمفتاح طبيعي

const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    // 🔑 المستخدم مالك الجلسة/القروب
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 🔑 معرف القروب في واتساب (مثال: 12036xxxxxxxxx@g.us)
    jid: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => typeof v === "string" && /@g\.us$/i.test(v),
        message: "jid must end with @g.us",
      },
    },

    // اسم القروب (يُحدّث من مزامنة واتساب)
    name: {
      type: String,
      default: "",
      trim: true,
    },

    // عدد الأعضاء (معلومات إحصائية اختيارية)
    members: {
      type: Number,
      default: 0,
      min: 0,
    },

    // عدد حالات الطرد التي قام بها البوت (لأغراض إحصائية)
    kicks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // حالة الحماية (تمكين منطق منع الروابط/السبام/الكلمات المحظورة)
    isProtected: {
      type: Boolean,
      default: false,
      index: true,
    },

    // قائمة الاستثناءات (أعضاء لا تُطبق عليهم الحماية)
    exceptions: [{
      jid: { type: String, required: true },
      name: { type: String, default: '' },
      reason: { type: String, default: '' },
      addedAt: { type: Date, default: Date.now }
    }],

    // إعدادات الحماية المتقدمة
    protectionSettings: {
      autoKick: { type: Boolean, default: false },
      autoDelete: { type: Boolean, default: true },
      allowOwnerBypass: { type: Boolean, default: true },
      warningBeforeKick: { type: Boolean, default: false },
      maxWarnings: { type: Number, default: 3 },
      muteBeforeKick: { type: Boolean, default: false },
      muteDuration: { type: Number, default: 300 } // بالثواني
    },

    // إحصائيات متقدمة
    statistics: {
      messagesProcessed: { type: Number, default: 0 },
      violationsDetected: { type: Number, default: 0 },
      usersWarned: { type: Number, default: 0 },
      messagesSent: { type: Number, default: 0 },
      lastActivity: { type: Date, default: null }
    },

    // معلومات القروب من WhatsApp
    whatsappInfo: {
      description: { type: String, default: '' },
      owner: { type: String, default: '' },
      admins: [{ type: String }],
      announce: { type: Boolean, default: false },
      restrict: { type: Boolean, default: false },
      creation: { type: Date, default: null }
    },

    // مساحة حرة لأي بيانات إضافية ترغب بحفظها
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // مخرجات أنظف للواجهة
        ret.id = ret.jid; // مريح للاستخدام في React key
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// 📌 منع تكرار نفس القروب لنفس المستخدم
GroupSchema.index({ user: 1, jid: 1 }, { unique: true });

/**
 * 🎯 Virtual للتوافق مع شيفرات تستخدم اسم protectionEnabled
 * يعكس نفس قيمة isProtected
 */
GroupSchema.virtual("protectionEnabled")
  .get(function () {
    return this.isProtected;
  })
  .set(function (val) {
    this.isProtected = !!val;
  });

/**
 * 💡 دالة مساعدة: إحضار قروب حسب user+jid
 */
GroupSchema.statics.findByUserAndJid = function (userId, jid) {
  return this.findOne({ user: userId, jid });
};

/**
 * 💡 upsert سريع بالـ jid
 */
GroupSchema.statics.upsertByJid = function (userId, jid, patch = {}) {
  return this.findOneAndUpdate(
    { user: userId, jid },
    {
      $set: {
        ...patch,
        // اجعل الاسم/الأعضاء اختياريًا عند التحديث
      },
      $setOnInsert: {
        name: patch.name || "",
        members: typeof patch.members === "number" ? patch.members : 0,
      },
    },
    { upsert: true, new: true }
  );
};

/**
 * 💡 تبديل حالة الحماية
 */
GroupSchema.methods.toggleProtection = function () {
  this.isProtected = !this.isProtected;
  return this.save();
};

/**
 * 💡 تفعيل/إيقاف الحماية صراحة
 */
GroupSchema.methods.setProtection = function (enabled) {
  this.isProtected = !!enabled;
  return this.save();
};

/**
 * 💡 زيادة عدّاد الطرد (إحصائي)
 */
GroupSchema.methods.incKicks = function (by = 1) {
  this.kicks = (this.kicks || 0) + (by || 1);
  this.statistics.usersWarned += by;
  this.statistics.lastActivity = new Date();
  return this.save();
};

/**
 * 💡 إضافة عضو للاستثناءات
 */
GroupSchema.methods.addException = function(jid, name = '', reason = '') {
  const existingException = this.exceptions.find(ex => ex.jid === jid);
  if (!existingException) {
    this.exceptions.push({
      jid: jid,
      name: name,
      reason: reason,
      addedAt: new Date()
    });
    return this.save();
  }
  return Promise.resolve(this);
};

/**
 * 💡 حذف عضو من الاستثناءات
 */
GroupSchema.methods.removeException = function(jid) {
  this.exceptions = this.exceptions.filter(ex => ex.jid !== jid);
  return this.save();
};

/**
 * 💡 التحقق من وجود عضو في الاستثناءات
 */
GroupSchema.methods.isException = function(jid) {
  return this.exceptions.some(ex => ex.jid === jid);
};

/**
 * 💡 تحديث الإحصائيات
 */
GroupSchema.methods.updateStats = function(type, count = 1) {
  switch(type) {
    case 'message':
      this.statistics.messagesProcessed += count;
      break;
    case 'violation':
      this.statistics.violationsDetected += count;
      break;
    case 'warning':
      this.statistics.usersWarned += count;
      break;
    case 'sent':
      this.statistics.messagesSent += count;
      break;
  }
  this.statistics.lastActivity = new Date();
  return this.save();
};

/**
 * 💡 تحديث معلومات WhatsApp
 */
GroupSchema.methods.updateWhatsAppInfo = function(info) {
  if (info.description !== undefined) this.whatsappInfo.description = info.description;
  if (info.owner !== undefined) this.whatsappInfo.owner = info.owner;
  if (info.admins !== undefined) this.whatsappInfo.admins = info.admins;
  if (info.announce !== undefined) this.whatsappInfo.announce = info.announce;
  if (info.restrict !== undefined) this.whatsappInfo.restrict = info.restrict;
  if (info.creation !== undefined) this.whatsappInfo.creation = info.creation;

  return this.save();
};

/**
 * 💡 Static method للبحث عن القروبات المحمية
 */
GroupSchema.statics.findProtected = function(userId) {
  return this.find({
    user: userId,
    isProtected: true
  });
};

/**
 * 💡 Static method للحصول على إحصائيات المستخدم
 */
GroupSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalGroups: { $sum: 1 },
        protectedGroups: { $sum: { $cond: ['$isProtected', 1, 0] } },
        totalMembers: { $sum: '$members' },
        totalKicks: { $sum: '$kicks' },
        totalViolations: { $sum: '$statistics.violationsDetected' },
        totalMessages: { $sum: '$statistics.messagesProcessed' }
      }
    }
  ]);
};

const Group = mongoose.model("Group", GroupSchema);
module.exports = Group;
