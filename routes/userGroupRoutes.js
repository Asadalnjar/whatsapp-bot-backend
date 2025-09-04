// routes/userGroupRoutes.js
const express = require("express");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const Group = require("../models/Group");

const router = express.Router();

/**
 * PUT /user/groups/:jid/protection
 * body (اختياري): { enabled: true|false }
 * - لو ما تم إرسال enabled، نعمل Toggle (نعكس الحالة)
 */
router.put(
  "/groups/:jid/protection",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid || "").trim();
      if (!/@g\.us$/i.test(jid)) {
        return res.status(400).json({ success: false, message: "Invalid group JID" });
      }

      const { enabled } = req.body || {};
      let doc = await Group.findOne({ user: req.user._id, jid });

      if (!doc) {
        // إن لم يوجد سجل لهذا المستخدم+القروب ننشئه ويفضل افتراضيًا التفعيل
        doc = await Group.create({
          user: req.user._id,
          jid,
          isProtected: typeof enabled === "boolean" ? !!enabled : true,
        });
      } else {
        // تحديث/تبديل الحالة
        if (typeof enabled === "boolean") {
          doc.isProtected = !!enabled;
        } else {
          doc.isProtected = !doc.isProtected;
        }
        await doc.save();
      }

      return res.json({
        success: true,
        message: doc.isProtected ? "✅ تم تفعيل الحماية" : "⏸️ تم إيقاف الحماية",
        data: {
          jid: doc.jid,
          isProtected: doc.isProtected,
          protectionEnabled: doc.isProtected, // للتوافق مع الواجهة
        },
      });
    } catch (e) {
      console.error("user/groups/:jid/protection error:", e?.message || e);
      return res
        .status(500)
        .json({ success: false, message: "Failed to toggle group protection" });
    }
  }
);

/**
 * GET /user/groups/:jid
 * (اختياري) جلب حالة قروب معيّن للمستخدم الحالي
 */
router.get(
  "/groups/:jid",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const jid = decodeURIComponent(req.params.jid || "").trim();
      if (!/@g\.us$/i.test(jid)) {
        return res.status(400).json({ success: false, message: "Invalid group JID" });
      }

      const doc = await Group.findOne({ user: req.user._id, jid });
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Group not found for this user" });
      }

      return res.json({
        success: true,
        data: {
          jid: doc.jid,
          name: doc.name,
          members: doc.members,
          isProtected: doc.isProtected,
          protectionEnabled: doc.isProtected,
          kicks: doc.kicks || 0,
          meta: doc.meta || {},
        },
      });
    } catch (e) {
      console.error("GET /user/groups/:jid error:", e?.message || e);
      return res.status(500).json({ success: false, message: "Failed to fetch group" });
    }
  }
);

/**
 * GET /user/groups
 * (اختياري) عرض القروبات المخزنة للمستخدم (من قاعدة البيانات)
 * ملاحظة: إن كنت تعتمد على مزامنة مباشرة من واتساب، هذا المسار يبقى مفيد
 * لقراءة حالة الحماية المخزنة لكل قروب.
 */
router.get(
  "/groups",
  protect,
  authorizeRoles("user", "admin"),
  async (req, res) => {
    try {
      const docs = await Group.find({ user: req.user._id }).sort({ name: 1, jid: 1 });
      const groups = docs.map((g) => ({
        jid: g.jid,
        name: g.name,
        members: g.members,
        isProtected: g.isProtected,
        protectionEnabled: g.isProtected,
        kicks: g.kicks || 0,
        meta: g.meta || {},
      }));
      return res.json({ success: true, data: groups });
    } catch (e) {
      console.error("GET /user/groups error:", e?.message || e);
      return res.status(500).json({ success: false, message: "Failed to list groups" });
    }
  }
);

module.exports = router;
