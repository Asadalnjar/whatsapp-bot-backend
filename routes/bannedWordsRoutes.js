// routes/bannedWordsRoutes.js
const express = require('express');
const {
  getBannedWords,
  addBannedWord,
  updateBannedWord,
  deleteBannedWord,
  toggleBannedWord,
  getBannedWordsStats,
  updateProtectionSettings,
  getProtectionSettings
} = require('../controllers/bannedWordsController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// جميع المسارات تتطلب تسجيل دخول فقط
router.use(protect);

/**
 * @desc   الحصول على جميع الكلمات المحظورة
 * @route  GET /user/banned-words
 * @access User
 */
router.get('/', getBannedWords);

/**
 * @desc   إضافة كلمة محظورة جديدة
 * @route  POST /user/banned-words
 * @access User
 */
router.post('/', validate(schemas.bannedWord), addBannedWord);

/**
 * @desc   تحديث كلمة محظورة
 * @route  PUT /user/banned-words/:id
 * @access User
 */
router.put('/:id', updateBannedWord);

/**
 * @desc   حذف كلمة محظورة
 * @route  DELETE /user/banned-words/:id
 * @access User
 */
router.delete('/:id', deleteBannedWord);

/**
 * @desc   تفعيل/إلغاء تفعيل كلمة محظورة
 * @route  PATCH /user/banned-words/:id/toggle
 * @access User
 */
router.patch('/:id/toggle', toggleBannedWord);

/**
 * @desc   الحصول على إحصائيات الكلمات المحظورة
 * @route  GET /user/banned-words/stats
 * @access User
 */
router.get('/stats', getBannedWordsStats);

/**
 * @desc   الحصول على إعدادات الحماية
 * @route  GET /user/protection/settings
 * @access User
 */
router.get('/protection/settings', getProtectionSettings);

/**
 * @desc   تحديث إعدادات الحماية
 * @route  PUT /user/protection/settings
 * @access User
 */
router.put('/protection/settings', updateProtectionSettings);

module.exports = router;
