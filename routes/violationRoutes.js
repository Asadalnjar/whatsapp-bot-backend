// routes/violationRoutes.js
// إدارة المخالفات

const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const Violation = require('../models/Violation');

const router = express.Router();

/**
 * @desc   جلب جميع المخالفات للمستخدم
 * @route  GET /user/violations
 * @access User
 */
router.get(
  '/violations',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, groupId, severity } = req.query;
      
      // بناء الفلتر
      const filter = { user: req.user._id };
      if (groupId) filter.groupId = groupId;
      if (severity) filter.severity = severity;

      // جلب المخالفات مع pagination
      const violations = await Violation.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // عدد المخالفات الكلي
      const total = await Violation.countDocuments(filter);

      res.json({
        success: true,
        violations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('خطأ في جلب المخالفات:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

/**
 * @desc   جلب إحصائيات المخالفات
 * @route  GET /user/violations/stats
 * @access User
 */
router.get(
  '/violations/stats',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const userId = req.user._id;

      // إحصائيات عامة
      const totalViolations = await Violation.countDocuments({ user: userId });
      const todayViolations = await Violation.countDocuments({
        user: userId,
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      });

      // إحصائيات حسب الشدة
      const severityStats = await Violation.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]);

      // إحصائيات حسب الإجراء
      const actionStats = await Violation.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]);

      // أكثر الكلمات المحظورة انتهاكاً
      const topWords = await Violation.aggregate([
        { $match: { user: userId, violationType: 'banned_word' } },
        { $group: { _id: '$detectedWord', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // أكثر القروبات انتهاكاً
      const topGroups = await Violation.aggregate([
        { $match: { user: userId } },
        { $group: { _id: { groupId: '$groupId', groupName: '$groupName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      res.json({
        success: true,
        stats: {
          total: totalViolations,
          today: todayViolations,
          severity: severityStats,
          actions: actionStats,
          topWords: topWords,
          topGroups: topGroups
        }
      });

    } catch (error) {
      console.error('خطأ في جلب إحصائيات المخالفات:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

/**
 * @desc   حذف مخالفة
 * @route  DELETE /user/violations/:id
 * @access User
 */
router.delete(
  '/violations/:id',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const violation = await Violation.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id
      });

      if (!violation) {
        return res.status(404).json({
          success: false,
          message: 'المخالفة غير موجودة'
        });
      }

      res.json({
        success: true,
        message: 'تم حذف المخالفة بنجاح'
      });

    } catch (error) {
      console.error('خطأ في حذف المخالفة:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

/**
 * @desc   حذف جميع المخالفات
 * @route  DELETE /user/violations
 * @access User
 */
router.delete(
  '/violations',
  protect,
  authorizeRoles('user', 'admin'),
  async (req, res) => {
    try {
      const result = await Violation.deleteMany({ user: req.user._id });

      res.json({
        success: true,
        message: `تم حذف ${result.deletedCount} مخالفة`
      });

    } catch (error) {
      console.error('خطأ في حذف المخالفات:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في السيرفر'
      });
    }
  }
);

module.exports = router;
