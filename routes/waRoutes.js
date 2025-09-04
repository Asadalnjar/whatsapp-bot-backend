// routes/waRoutes.js
// ==================
// مسارات واجهة واتساب (Baileys)

const express = require("express");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const {
  startSession,
  getStatus,
  sendTo,
  stopSession,
  // القروبات
  fetchAllGroups,
  joinGroupByInvite,
  leaveGroup,
  sendToGroup,
} = require("../services/waService");

const WaSession = require("../models/WaSession");

const router = express.Router();

/**
 * POST /wa/session/start
 * بدء/تجديد جلسة واتساب للمستخدم الحالي.
 * - لا يُرجع QR في الاستجابة؛ الـQR يُبث عبر Socket إلى غرفة user:{_id}
 */
router.post(
  "/session/start",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

      // إضافة معلومات الجهاز للمستخدم
      req.user.deviceInfo = {
        isMobile,
        userAgent,
        ip: req.ip
      };

      await startSession(req.user);

      // إرجاع معلومات إضافية للموبايل
      return res.status(202).json({
        success: true,
        message: "Session starting...",
        deviceInfo: {
          isMobile,
          supportedMethods: isMobile ? ['link', 'share', 'qr'] : ['qr']
        }
      });
    } catch (e) {
      console.error("wa/session/start error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: "Failed to start session" });
    }
  }
);

/**
 * GET /wa/device-info
 * جلب معلومات الجهاز والطرق المدعومة
 */
router.get(
  "/device-info",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);

      const deviceInfo = {
        isMobile,
        isIOS,
        isAndroid,
        userAgent,
        supportedMethods: isMobile ? ['link', 'share', 'qr'] : ['qr'],
        recommendations: {
          primary: isMobile ? 'link' : 'qr',
          alternatives: isMobile ? ['share', 'qr'] : ['link']
        }
      };

      res.json({
        success: true,
        deviceInfo
      });
    } catch (error) {
      console.error("device-info error:", error);
      res.status(500).json({
        success: false,
        message: "فشل في جلب معلومات الجهاز"
      });
    }
  }
);

/**
 * GET /wa/session/status
 * جلب حالة الجلسة للمستخدم الحالي.
 */
router.get(
  "/session/status",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const st = getStatus(req.user._id);
      return res.json({ success: true, data: st });
    } catch (e) {
      console.error("wa/session/status error:", e?.message || e);
      return res
        .status(200)
        .json({ success: true, data: { connected: false, status: "INIT" } });
    }
  }
);

/**
 * POST /wa/send
 * إرسال رسالة نصية عبر جلسة المستخدم الحالي.
 * body: { to: "+9677xxxxxxx", text: "hello" }
 */
router.post(
  "/send",
  protect,
  authorizeRoles("admin", "user"),
  async (req, res) => {
    try {
      const { to, text } = req.body || {};

      // تحقّق بدائي (E164 تقريبي) ومحتوى النص
      const e164Ok = typeof to === "string" && /^\+?[1-9]\d{6,14}$/.test(to.trim());
      if (!e164Ok) {
        return res.status(400).json({
          success: false,
          message: "Invalid 'to' format. Use E164 like +9677xxxxxxx",
        });
      }
      if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: "Text is required",
        });
      }

      await sendTo(req.user._id, to.trim(), text.trim());
      return res.json({ success: true });
    } catch (e) {
      console.error("wa/send error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: e?.message || "Failed to send" });
    }
  }
);

/**
 * POST /wa/session/stop
 * إيقاف جلسة المستخدم الحالي وتنظيف الذاكرة.
 */
router.post(
  "/session/stop",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      if (typeof stopSession === "function") {
        await stopSession(req.user._id);
      }
      return res.json({ success: true, message: "Session stopped" });
    } catch (e) {
      console.error("wa/session/stop error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: "Failed to stop session" });
    }
  }
);

// ==================
// مسارات القروبات
// ==================

/**
 * GET /wa/groups/sync
 * جلب كل القروبات التي يشارك فيها الحساب الحالي
 * - يرجع 409 SESSION_NOT_READY إذا الجلسة غير جاهزة
 */
router.get(
  "/groups/sync",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const st = getStatus(req.user._id);
      if (!st.connected) {
        return res.status(409).json({
          success: false,
          code: "SESSION_NOT_READY",
          message: "WhatsApp session not ready",
          data: st,
        });
      }

      const groups = await fetchAllGroups(req.user._id);
      // ✅ الواجهة تقرأ groups، وأبقينا data للتوافق
      return res.json({ success: true, groups, data: groups });
    } catch (e) {
      console.error("wa/groups/sync error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: e?.message || "Failed to fetch groups" });
    }
  }
);

/**
 * POST /wa/groups/join
 * body: { inviteLink: "https://chat.whatsapp.com/XXXXX" }
 */
router.post(
  "/groups/join",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const { inviteLink } = req.body || {};
      if (!inviteLink) {
        return res.status(400).json({ success: false, message: "inviteLink is required" });
      }
      const { jid } = await joinGroupByInvite(req.user._id, inviteLink);
      return res.json({ success: true, jid });
    } catch (e) {
      console.error("wa/groups/join error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: e?.message || "Failed to join group" });
    }
  }
);

/**
 * POST /wa/groups/leave
 * body: { jid: "<groupJid>@g.us" }
 */
router.post(
  "/groups/leave",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const { jid } = req.body || {};
      if (!jid || !String(jid).endsWith("@g.us")) {
        return res.status(400).json({ success: false, message: "Invalid group JID" });
      }
      await leaveGroup(req.user._id, jid);
      return res.json({ success: true });
    } catch (e) {
      console.error("wa/groups/leave error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: e?.message || "Failed to leave group" });
    }
  }
);

/**
 * POST /wa/groups/send
 * body: { jid: "<groupJid>@g.us", text: "message" }
 */
router.post(
  "/groups/send",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const { jid, text } = req.body || {};
      if (!jid || !String(jid).endsWith("@g.us") || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ success: false, message: "jid & text required" });
      }
      await sendToGroup(req.user._id, jid, text.trim());
      return res.json({ success: true });
    } catch (e) {
      console.error("wa/groups/send error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: e?.message || "Failed to send to group" });
    }
  }
);

/**
 * GET /wa/session/settings
 * جلب إعدادات الحماية للجلسة
 */
router.get(
  "/session/settings",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      console.log('🔍 البحث عن جلسة للمستخدم:', req.user._id);
      const waSession = await WaSession.findOne({ user: req.user._id });
      console.log('📊 نتيجة البحث:', waSession ? 'موجودة' : 'غير موجودة');

      if (!waSession) {
        console.log('❌ لا توجد جلسة واتساب للمستخدم:', req.user._id);
        return res.status(404).json({
          success: false,
          message: "لا توجد جلسة واتساب"
        });
      }

      res.json({
        success: true,
        settings: {
          protectionEnabled: waSession.protectionEnabled || false,
          protectionSettings: waSession.protectionSettings || {
            autoKick: false,
            autoDelete: true,
            allowOwnerBypass: true
          }
        }
      });

    } catch (error) {
      console.error("خطأ في جلب إعدادات الجلسة:", error);
      res.status(500).json({
        success: false,
        message: "خطأ في السيرفر"
      });
    }
  }
);

/**
 * PUT /wa/session/settings
 * تحديث إعدادات الحماية للجلسة
 */
router.put(
  "/session/settings",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const { protectionEnabled, protectionSettings } = req.body;

      const waSession = await WaSession.findOne({ user: req.user._id });

      if (!waSession) {
        return res.status(404).json({
          success: false,
          message: "لا توجد جلسة واتساب"
        });
      }

      // تحديث الإعدادات
      if (protectionEnabled !== undefined) {
        waSession.protectionEnabled = protectionEnabled;
      }

      if (protectionSettings) {
        waSession.protectionSettings = {
          ...waSession.protectionSettings,
          ...protectionSettings
        };
      }

      await waSession.save();

      res.json({
        success: true,
        message: "تم تحديث الإعدادات بنجاح",
        settings: {
          protectionEnabled: waSession.protectionEnabled,
          protectionSettings: waSession.protectionSettings
        }
      });

    } catch (error) {
      console.error("خطأ في تحديث إعدادات الجلسة:", error);
      res.status(500).json({
        success: false,
        message: "خطأ في السيرفر"
      });
    }
  }
);

module.exports = router;
