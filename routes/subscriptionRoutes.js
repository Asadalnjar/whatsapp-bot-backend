// routes/subscriptionRoutes.js
const express = require('express');
const {
  getUserSubscription,
  createSubscription,
  uploadInvoice
} = require('../controllers/subscriptionController');
const { protect, requireActiveSubscription } = require('../middleware/authMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadInvoice');

const router = express.Router();

// جميع المسارات تتطلب تسجيل دخول
router.use(protect);

/**
 * @desc   الحصول على اشتراك المستخدم الحالي
 * @route  GET /user/subscription
 * @access User
 */
router.get('/', getUserSubscription);

/**
 * @desc   إنشاء اشتراك جديد
 * @route  POST /user/subscription
 * @access User
 */
router.post('/', createSubscription);

/**
 * @desc   رفع فاتورة الدفع
 * @route  POST /user/subscription/:id/invoice
 * @access User
 */
router.post('/:id/invoice', uploadSingle, handleUploadError, uploadInvoice);

module.exports = router;
