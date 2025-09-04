// controllers/groupController.js
// ==============================
// منطق إدارة القروبات للمستخدم:
// - قراءة قائمة القروبات (مُدمجة من واتساب + حالة الحماية من قاعدة البيانات)
// - تبديل حالة الحماية باستخدام JID (وليس ObjectId)

const Group = require("../models/Group");
const { fetchAllGroups } = require("../services/waService");

/**
 * @desc  جلب جميع قروبات المستخدم (مزامنة + دمج حالة الحماية)
 * @route GET /user/groups
 * @access User/Admin
 *
 * يعيد الشكل:
 * { success: true, groups: [{ id, name, size, isAnnounce, isLocked, isProtected }] }
 */
const getUserGroups = async (req, res) => {
  try {
    // 1) مزامنة من واتساب عبر Baileys
    const waList = await fetchAllGroups(req.user._id); // [{ id, name, size, ... }]

    // 2) اجلب سجلات القروبات من DB للمستخدم نفسه
    const jids = waList.map((g) => g.id);
    const dbGroups = await Group.find({
      user: req.user._id,
      jid: { $in: jids },
    }).lean();

    // 3) خريطة سريعة لحالة الحماية
    const protMap = new Map(dbGroups.map((d) => [d.jid, !!d.isProtected]));

    // 4) دمج: أضف isProtected على عناصر واتساب
    const merged = waList.map((g) => ({
      ...g,
      isProtected: protMap.get(g.id) || false,
    }));

    // 5) (اختياري) عمل upsert للأسماء/الأعداد للاستخدام لاحقًا
    await Promise.all(
      waList.map((g) =>
        Group.findOneAndUpdate(
          { user: req.user._id, jid: g.id },
          {
            $set: {
              name: g.name || "",
              members: Number.isFinite(g.size) ? g.size : 0,
            },
          },
          { upsert: true, new: false }
        )
      )
    );

    return res.json({ success: true, groups: merged });
  } catch (error) {
    console.error("getUserGroups error:", error);
    return res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc  تبديل حالة الحماية لقروب عبر JID (وليس ObjectId)
 * @route PUT /user/groups/:jid/protection
 * @access User/Admin (صاحب الجلسة فقط)
 *
 * يقبل باراميتر :jid مثل 12036...@g.us (يُفضّل أن يكون مُرمّز URL)
 */
const toggleGroupProtection = async (req, res) => {
  try {
    // ندعم كلا الاسمين احتياطاً (jid أو id) لتوافق كود قديم
    const raw = req.params.jid ?? req.params.id ?? "";
    const jid = decodeURIComponent(String(raw));

    if (!jid || !jid.endsWith("@g.us")) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid group JID" });
    }

    // احضر السجل الحالي للمستخدم/القروب
    const existing = await Group.findOne({ user: req.user._id, jid });

    const next = !(existing?.isProtected);

    // upsert — إذا ما وجدناه ننشئه مع الحالة الجديدة
    const updated = await Group.findOneAndUpdate(
      { user: req.user._id, jid },
      {
        $set: { isProtected: next },
        $setOnInsert: { name: "", members: 0 },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: `✅ تم ${next ? "تفعيل" : "إيقاف"} الحماية للقروب`,
      group: updated,
      isProtected: next,
    });
  } catch (error) {
    console.error("toggleGroupProtection error:", error);
    return res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc  تحديث إعدادات حماية القروب
 * @route PUT /user/groups/:gid/protection
 * @access User
 */
const updateGroupProtection = async (req, res) => {
  try {
    const { gid } = req.params;
    const { isProtected, protectionSettings } = req.body;

    // البحث عن القروب أو إنشاؤه
    let group = await Group.findOne({
      user: req.user._id,
      jid: gid
    });

    if (!group) {
      // إنشاء سجل جديد للقروب
      group = new Group({
        user: req.user._id,
        jid: gid,
        name: 'Unknown Group',
        isProtected: isProtected || false
      });
    } else {
      // تحديث الحماية
      if (isProtected !== undefined) {
        group.isProtected = isProtected;
      }

      // تحديث إعدادات الحماية إذا تم توفيرها
      if (protectionSettings) {
        group.protectionSettings = {
          ...group.protectionSettings,
          ...protectionSettings
        };
      }
    }

    await group.save();

    res.json({
      success: true,
      message: `تم ${isProtected ? 'تفعيل' : 'إلغاء تفعيل'} الحماية للقروب`,
      group: {
        jid: group.jid,
        name: group.name,
        isProtected: group.isProtected,
        protectionSettings: group.protectionSettings
      }
    });

  } catch (error) {
    console.error('❌ updateGroupProtection error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

module.exports = {
  getUserGroups,
  toggleGroupProtection,
  updateGroupProtection
};
