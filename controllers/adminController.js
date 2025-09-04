const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const WaSession = require("../models/WaSession");
const Notification = require("../models/Notification");

/**
 * @desc   جلب جميع المشتركين
 * @route  GET /admin/users
 * @access Admin
 */
const getAllUsers = async (req, res) => {
  try {
    // نجلب جميع المستخدمين ما عدا كلمة المرور
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error("❌ خطأ أثناء جلب المستخدمين:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   تغيير حالة المشترك (نشط / موقوف / مرفوض / قيد المراجعة)
 * @route  PUT /admin/users/:id/status
 * @access Admin
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ✅ القيم المسموح بها (النظام الجديد)
    const allowedStatuses = ['pending', 'active', 'suspended', 'banned'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "❌ قيمة الحالة غير صالحة. القيم المسموحة: pending, active, suspended, banned"
      });
    }

    // البحث عن المستخدم
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    // تحديث الحالة
    user.status = status;
    await user.save();

    res.json({ message: `✅ تم تحديث حالة المستخدم إلى ${status}` });
  } catch (error) {
    console.error("❌ خطأ أثناء تحديث حالة المستخدم:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   حذف مشترك
 * @route  DELETE /admin/users/:id
 * @access Admin
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }

    res.json({ message: "✅ تم حذف المستخدم بنجاح" });
  } catch (error) {
    console.error("❌ خطأ أثناء حذف المستخدم:", error);
    res.status(500).json({ message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   جلب الاشتراكات قيد المراجعة
 * @route  GET /admin/subscriptions/pending
 * @access Admin
 */
const getPendingSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      status: 'under_review'
    })
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 });

    // جلب الفواتير المرتبطة
    const subscriptionsWithInvoices = await Promise.all(
      subscriptions.map(async (subscription) => {
        const invoices = await Invoice.find({
          subscriptionId: subscription._id
        }).sort({ createdAt: -1 });

        return {
          ...subscription.toObject(),
          invoices
        };
      })
    );

    res.json({
      success: true,
      subscriptions: subscriptionsWithInvoices
    });

  } catch (error) {
    console.error('❌ getPendingSubscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   قبول اشتراك
 * @route  PATCH /admin/subscriptions/:id/approve
 * @access Admin
 */
const approveSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('userId', 'name email phone');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'الاشتراك غير موجود'
      });
    }

    // تفعيل الاشتراك
    await subscription.activate();

    // تحديث حالة المستخدم
    const user = await User.findById(subscription.userId._id);
    if (user) {
      await user.activate();
    }

    // إنشاء جلسة WhatsApp للمستخدم
    let waSession = await WaSession.findOne({ user: subscription.userId._id });
    if (!waSession) {
      waSession = new WaSession({
        user: subscription.userId._id,
        state: 'inactive'
      });
      await waSession.save();
    }

    // قبول الفاتورة المرتبطة
    const invoice = await Invoice.findOne({
      subscriptionId: subscription._id,
      status: { $in: ['uploaded', 'pending'] }
    });

    if (invoice) {
      await invoice.accept(req.user._id);
    }

    // إنشاء إشعار للمستخدم
    await Notification.createNotification({
      toUserId: subscription.userId._id,
      type: 'subscription_approved',
      title: 'تم قبول اشتراكك!',
      body: 'تم قبول اشتراكك وتفعيله بنجاح. يمكنك الآن استخدام جميع الخدمات.',
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'تم قبول الاشتراك وتفعيله بنجاح'
    });

  } catch (error) {
    console.error('❌ approveSubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   رفض اشتراك
 * @route  PATCH /admin/subscriptions/:id/reject
 * @access Admin
 */
const rejectSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const subscription = await Subscription.findById(id)
      .populate('userId', 'name email phone');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'الاشتراك غير موجود'
      });
    }

    // تحديث حالة الاشتراك
    subscription.status = 'rejected';
    subscription.notes = reason || 'تم رفض الاشتراك من قبل الإدارة';
    await subscription.save();

    // رفض الفاتورة المرتبطة
    const invoice = await Invoice.findOne({
      subscriptionId: subscription._id,
      status: { $in: ['uploaded', 'pending'] }
    });

    if (invoice) {
      await invoice.reject(req.user._id, reason);
    }

    // إنشاء إشعار للمستخدم
    await Notification.createNotification({
      toUserId: subscription.userId._id,
      type: 'subscription_rejected',
      title: 'تم رفض اشتراكك',
      body: `تم رفض اشتراكك. السبب: ${reason || 'لم يتم تحديد السبب'}`,
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'تم رفض الاشتراك'
    });

  } catch (error) {
    console.error('❌ rejectSubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

module.exports = {
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getPendingSubscriptions,
  approveSubscription,
  rejectSubscription
};
