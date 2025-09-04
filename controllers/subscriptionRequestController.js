// controllers/subscriptionRequestController.js
const SubscriptionRequest = require("../models/SubscriptionRequest");
const { notifyAdminNewSubscription } = require('../services/emailService');

/**
 * @desc   إنشاء طلب اشتراك جديد مع إرسال إشعار للمشرف
 * @route  POST /subscription-requests
 * @access Public
 */
const createSubscriptionRequest = async (req, res) => {
  try {
    const { name, phone, plan, method, amount } = req.body;

    // إنشاء طلب الاشتراك
    const newRequest = new SubscriptionRequest({
      name,
      phone,
      plan,
      method,
      amount,
      status: "قيد المراجعة"
    });

    await newRequest.save();

    // إرسال إشعار للمشرف
    try {
      await notifyAdminNewSubscription(newRequest);
      console.log('✅ تم إرسال إشعار للمشرف عن طلب اشتراك جديد');
    } catch (emailError) {
      console.error('❌ خطأ في إرسال إشعار الإيميل:', emailError);
      // لا نوقف العملية إذا فشل الإيميل
    }

    res.status(201).json({
      success: true,
      message: "✅ تم إرسال طلب الاشتراك بنجاح. سيتم مراجعته قريباً.",
      request: newRequest
    });

  } catch (error) {
    console.error('خطأ في إنشاء طلب الاشتراك:', error);
    res.status(500).json({
      success: false,
      message: "❌ خطأ في السيرفر"
    });
  }
};

/**
 * @desc   عرض جميع طلبات الاشتراك الجديدة
 * @route  GET /admin/new-subscribers
 * @access Admin
 */
const getAllSubscriptionRequests = async (req, res) => {
  try {
    const requests = await SubscriptionRequest.find().sort({ requestedAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   الموافقة على طلب الاشتراك
 * @route  POST /admin/new-subscribers/approve/:id
 * @access Admin
 */
const approveSubscriptionRequest = async (req, res) => {
  try {
    const request = await SubscriptionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "❌ الطلب غير موجود" });
    }

    request.status = "موافق عليه";
    await request.save();

    res.json({ message: "✅ تم الموافقة على الاشتراك", request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   رفض طلب الاشتراك
 * @route  POST /admin/new-subscribers/reject/:id
 * @access Admin
 */
const rejectSubscriptionRequest = async (req, res) => {
  try {
    const request = await SubscriptionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "❌ الطلب غير موجود" });
    }

    request.status = "مرفوض";
    await request.save();

    res.json({ message: "✅ تم رفض طلب الاشتراك", request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  createSubscriptionRequest,
  getAllSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest
};
