// controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { notifyAdminNewSubscription, notifyUserSubscriptionApproved, notifyUserSubscriptionRejected } = require('../services/emailService');

/**
 * @desc   عرض اشتراك المستخدم الحالي
 * @route  GET /user/subscription
 * @access User/Admin
 */
const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await Subscription.findOne({ userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد اشتراك'
      });
    }

    // الحصول على الفواتير المرتبطة
    const invoices = await Invoice.find({ subscriptionId: subscription._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        amount: subscription.amount,
        currency: subscription.currency,
        notes: subscription.notes,
        paymentInfo: subscription.paymentInfo,
        isExpired: subscription.isExpired,
        isExpiringSoon: subscription.isExpiringSoon,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      },
      invoices: invoices.map(invoice => ({
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        method: invoice.method,
        status: invoice.status,
        fileUrl: invoice.fileUrl,
        createdAt: invoice.createdAt,
        paidAt: invoice.paidAt
      }))
    });

  } catch (error) {
    console.error('❌ getUserSubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   إنشاء اشتراك جديد
 * @route  POST /user/subscription
 * @access User
 */
const createSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan, amount, paymentMethod } = req.body;

    // التحقق من البيانات المطلوبة
    if (!plan || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء تعبئة جميع الحقول المطلوبة'
      });
    }

    // التحقق من وجود اشتراك نشط
    const existingSubscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'under_review', 'approved'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'لديك اشتراك نشط بالفعل'
      });
    }

    // إنشاء اشتراك جديد
    const newSubscription = new Subscription({
      userId,
      plan,
      amount,
      status: 'pending_payment',
      paymentInfo: {
        method: paymentMethod
      }
    });

    await newSubscription.save();

    // إنشاء إشعار
    await Notification.createNotification({
      toUserId: userId,
      type: 'subscription_approved',
      title: 'تم إنشاء اشتراك جديد',
      body: `تم إنشاء اشتراك ${plan} بقيمة ${amount} ريال. يرجى رفع إثبات الدفع لإكمال العملية.`,
      priority: 'normal'
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الاشتراك بنجاح. يرجى رفع إثبات الدفع.',
      subscription: {
        id: newSubscription._id,
        plan: newSubscription.plan,
        status: newSubscription.status,
        amount: newSubscription.amount,
        currency: newSubscription.currency
      }
    });

  } catch (error) {
    console.error('❌ createSubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   رفع فاتورة الدفع
 * @route  POST /user/subscription/:id/invoice
 * @access User
 */
const uploadInvoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const subscriptionId = req.params.id;
    const { amount, method, reference } = req.body;

    // التحقق من وجود الاشتراك
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'الاشتراك غير موجود'
      });
    }

    // التحقق من رفع الملف
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى رفع ملف إثبات الدفع'
      });
    }

    // إنشاء رقم فاتورة فريد
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // إنشاء فاتورة جديدة
    const newInvoice = new Invoice({
      subscriptionId,
      userId,
      invoiceNumber,
      amount: amount || subscription.amount,
      method: method || subscription.paymentInfo.method,
      reference: reference || '',
      fileUrl: `/uploads/invoices/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يوم
      status: 'uploaded'
    });

    await newInvoice.save();

    // تحديث حالة الاشتراك
    subscription.status = 'under_review';
    subscription.paymentInfo.reference = reference || '';
    await subscription.save();

    // إنشاء إشعار للمستخدم
    await Notification.createNotification({
      toUserId: userId,
      type: 'invoice_uploaded',
      title: 'تم رفع إثبات الدفع',
      body: 'تم رفع إثبات الدفع بنجاح. سيتم مراجعته من قبل الإدارة خلال 24 ساعة.',
      priority: 'normal'
    });

    // إنشاء إشعار للمشرفين
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await Notification.createNotification({
        toUserId: admin._id,
        type: 'invoice_uploaded',
        title: 'فاتورة جديدة للمراجعة',
        body: `تم رفع فاتورة جديدة من المستخدم ${req.user.name} للمراجعة.`,
        priority: 'high'
      });
    }

    res.json({
      success: true,
      message: 'تم رفع إثبات الدفع بنجاح. سيتم مراجعته قريباً.',
      invoice: {
        id: newInvoice._id,
        invoiceNumber: newInvoice.invoiceNumber,
        amount: newInvoice.amount,
        method: newInvoice.method,
        status: newInvoice.status,
        fileUrl: newInvoice.fileUrl
      }
    });

  } catch (error) {
    console.error('❌ uploadInvoice error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

module.exports = {
  getUserSubscription,
  createSubscription,
  uploadInvoice
};
