// controllers/adminSettingsController.js
const AdminSettings = require("../models/AdminSettings");

// ===== Helpers =====
async function ensureSettings() {
  let s = await AdminSettings.findOne();
  if (!s) s = await AdminSettings.create({});
  return s;
}

function toArrayOfStrings(value) {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(/[,\n]/g)
      .map((x) => x.trim())
      .filter(Boolean);
  return undefined;
}

// ==============================
// عرض الإعدادات العامة (جميع الحقول)
// ==============================
const getAdminSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

// ============================================
// تعديل الإعدادات العامة + حقول الحماية الجديدة
// ============================================
const updateAdminSettings = async (req, res) => {
  try {
    const {
      bannedWords,         // array|string (اختياري)
      supportEmail,        // string
      supportPhone,        // string
      openAiKey,           // string
      paypalClientId,      // string
      autoKickEnabled,     // boolean
      autoReplyEnabled,    // boolean
    } = req.body || {};

    const settings = await ensureSettings();

    // bannedWords: نقبل مصفوفة أو نص مفصول بفواصل/أسطر
    const bw = toArrayOfStrings(bannedWords);
    if (bw) settings.bannedWords = bw;

    if (typeof supportEmail === "string") settings.supportEmail = supportEmail.trim();
    if (typeof supportPhone === "string") settings.supportPhone = supportPhone.trim();
    if (typeof openAiKey === "string") settings.openAiKey = openAiKey.trim();
    if (typeof paypalClientId === "string") settings.paypalClientId = paypalClientId.trim();

    if (typeof autoKickEnabled === "boolean") settings.autoKickEnabled = autoKickEnabled;
    if (typeof autoReplyEnabled === "boolean") settings.autoReplyEnabled = autoReplyEnabled;

    await settings.save();
    res.json({ success: true, message: "✅ تم حفظ الإعدادات بنجاح", data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

// =======================================
// إدارة الكلمات المحظورة: إضافة كلمة واحدة
// =======================================
const addBannedWord = async (req, res) => {
  try {
    const { word } = req.body || {};
    if (!word || typeof word !== "string" || !word.trim()) {
      return res.status(400).json({ success: false, message: "🚫 يجب إرسال كلمة صحيحة" });
    }
    const settings = await ensureSettings();
    const w = word.trim();
    if (!settings.bannedWords.includes(w)) {
      settings.bannedWords.push(w);
      await settings.save();
    }
    res.json({ success: true, message: "✅ تمت إضافة الكلمة", data: settings.bannedWords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

// =======================================
// إدارة الكلمات المحظورة: حذف كلمة واحدة
// =======================================
const removeBannedWord = async (req, res) => {
  try {
    const { word } = req.params || {};
    if (!word) {
      return res.status(400).json({ success: false, message: "🚫 يجب تحديد الكلمة في الرابط" });
    }
    const settings = await ensureSettings();
    const before = settings.bannedWords.length;
    settings.bannedWords = (settings.bannedWords || []).filter((w) => w !== word);
    const changed = settings.bannedWords.length !== before;
    await settings.save();
    res.json({
      success: true,
      message: changed ? "✅ تم حذف الكلمة" : "ℹ️ الكلمة غير موجودة",
      data: settings.bannedWords,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getAdminSettings,
  updateAdminSettings,
  addBannedWord,
  removeBannedWord,
};
