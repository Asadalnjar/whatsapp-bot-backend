// routes/groupExceptionRoutes.js
// إدارة استثناءات القروبات

const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const Group = require('../models/Group');

const router = express.Router();

/**
 * @desc   إضافة مستخدم لقائمة الاستثناءات في قروب
 * @route  POST /user/groups/:jid/exceptions
 * @access User
 */
router.post(
  '/groups/:jid/exceptions',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const { jid } = req.params;
      const { userJid, name, reason } = req.body;

      if (!userJid) {
        return res.status(400).json({
          success: false,
          message: 'معرف المستخدم مطلوب'
        });
      }

      // البحث عن القروب
      const group = await Group.findOne({
        user: req.user._id,
        jid: jid
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'القروب غير موجود'
        });
      }

      // التحقق من عدم وجود المستخدم في الاستثناءات مسبقاً
      const existingException = group.exceptions.find(ex => ex.jid === userJid);
      if (existingException) {
        return res.status(400).json({
          success: false,
          message: 'المستخدم موجود في قائمة الاستثناءات مسبقاً'
        });
      }

      // إضافة المستخدم للاستثناءات
      group.exceptions.push({
        jid: userJid,
        name: name || '',
        reason: reason || 'تم إضافته يدوياً',
        addedAt: new Date()
      });

      await group.save();

      res.json({
        success: true,
        message: 'تم إضافة المستخدم لقائمة الاستثناءات بنجاح',
        exception: {
          jid: userJid,
          name: name || '',
          reason: reason || 'تم إضافته يدوياً'
        }
      });

    } catch (error) {
      console.error('خطأ في إضافة استثناء:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

/**
 * @desc   حذف مستخدم من قائمة الاستثناءات
 * @route  DELETE /user/groups/:jid/exceptions/:userJid
 * @access User
 */
router.delete(
  '/groups/:jid/exceptions/:userJid',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const { jid, userJid } = req.params;

      // البحث عن القروب
      const group = await Group.findOne({
        user: req.user._id,
        jid: jid
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'القروب غير موجود'
        });
      }

      // حذف المستخدم من الاستثناءات
      const initialLength = group.exceptions.length;
      group.exceptions = group.exceptions.filter(ex => ex.jid !== userJid);

      if (group.exceptions.length === initialLength) {
        return res.status(404).json({
          success: false,
          message: 'المستخدم غير موجود في قائمة الاستثناءات'
        });
      }

      await group.save();

      res.json({
        success: true,
        message: 'تم حذف المستخدم من قائمة الاستثناءات بنجاح'
      });

    } catch (error) {
      console.error('خطأ في حذف استثناء:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

/**
 * @desc   جلب قائمة الاستثناءات لقروب
 * @route  GET /user/groups/:jid/exceptions
 * @access User
 */
router.get(
  '/groups/:jid/exceptions',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const { jid } = req.params;

      // البحث عن القروب
      const group = await Group.findOne({
        user: req.user._id,
        jid: jid
      });

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'القروب غير موجود'
        });
      }

      res.json({
        success: true,
        exceptions: group.exceptions || []
      });

    } catch (error) {
      console.error('خطأ في جلب الاستثناءات:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

module.exports = router;
