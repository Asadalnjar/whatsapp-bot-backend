// controllers/billingController.js
const Billing = require("../models/Billing");

/**
 * @desc   جلب جميع الفواتير
 * @route  GET /admin/billing
 * @access Admin
 */
const getAllBillings = async (req, res) => {
  try {
    const billings = await Billing.find()
      .populate("user", "name phone")
      .sort({ date: -1 });

    res.json({
      success: true,
      count: billings.length,
      data: billings
    });
  } catch (error) {
    console.error("❌ خطأ في جلب الفواتير:", error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   إنشاء فاتورة جديدة (مع دعم رفع إثبات الدفع)
 * @route  POST /admin/billing
 * @access Admin
 */
const createBilling = async (req, res) => {
  try {
    const { userId, plan, amount, method, status } = req.body;

    if (!userId || !plan || !amount || !method) {
      return res.status(400).json({ success: false, message: "❌ جميع الحقول مطلوبة" });
    }

    // ✅ منع تكرار الفاتورة لنفس المستخدم في نفس الخطة بنفس اليوم
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingBilling = await Billing.findOne({
      user: userId,
      plan,
      status: "ناجحة",
      startDate: { $gte: today }
    });

    if (existingBilling) {
      return res.status(400).json({
        success: false,
        message: "⚠️ يوجد بالفعل فاتورة ناجحة اليوم لنفس المستخدم والخطة"
      });
    }

    // تحديد مسار إثبات الدفع إذا تم رفع ملف
    let proofFile = "";
    if (req.file) {
      proofFile = `/uploads/billing/${req.file.filename}`;
    }

    const startDate = status === "ناجحة" ? new Date() : null;
    let endDate = null;

    if (status === "ناجحة") {
      endDate = new Date(startDate);
      if (plan === "شهري") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan === "سنوي") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
    }

    const newBilling = new Billing({
      user: userId,
      plan,
      amount,
      method,
      status,
      startDate,
      endDate,
      proofFile
    });

    await newBilling.save();

    res.status(201).json({
      success: true,
      message: "✅ تم إنشاء الفاتورة بنجاح",
      data: newBilling
    });
  } catch (error) {
    console.error("❌ خطأ في إنشاء الفاتورة:", error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

/**
 * @desc   تحديث حالة الفاتورة
 * @route  PUT /admin/billing/:id/status
 * @access Admin
 */
const updateBillingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const billing = await Billing.findById(req.params.id);

    if (!billing) {
      return res.status(404).json({ success: false, message: "❌ الفاتورة غير موجودة" });
    }

    // ✅ تأكد أن الحالة الحالية هي "معلقة" فقط
    if (billing.status !== "معلقة") {
      return res.status(400).json({
        success: false,
        message: `⚠️ لا يمكن تعديل حالة الفاتورة لأنها حالياً "${billing.status}"`
      });
    }

    billing.status = status;

    if (status === "ناجحة") {
      billing.startDate = new Date();
      billing.endDate = new Date(billing.startDate);

      if (billing.plan === "شهري") {
        billing.endDate.setMonth(billing.endDate.getMonth() + 1);
      } else if (billing.plan === "سنوي") {
        billing.endDate.setFullYear(billing.endDate.getFullYear() + 1);
      }
    } else {
      billing.startDate = null;
      billing.endDate = null;
    }

    await billing.save();

    res.json({
      success: true,
      message: "✅ تم تحديث حالة الفاتورة بنجاح",
      data: billing
    });
  } catch (error) {
    console.error("❌ خطأ في تحديث حالة الفاتورة:", error);
    res.status(500).json({ success: false, message: "❌ خطأ في السيرفر" });
  }
};

module.exports = {
  getAllBillings,
  createBilling,
  updateBillingStatus
};
