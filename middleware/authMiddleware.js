// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Subscription = require("../models/Subscription");

/**
 * حماية المسارات عبر JWT
 * - يعيد 401 برسالة "jwt expired" عند انتهاء الصلاحية (مهم للفرونت لتجديد التوكن)
 * - يعيد 401 برسالة "jwt invalid" عند عدم صحة التوكن
 * - يفحص حالة الحساب ويعيد 403 إن كان غير نشط
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // 1) الحصول على التوكن من Authorization أو من كوكي accessToken
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7);
    else if (req.cookies?.accessToken) token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "لا يوجد توكن",
      });
    }

    // 2) التحقق من صحة التوكن
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      // اجعل الرسائل دقيقة ليستفيد منها الإنترسبتور في الفرونت
      if (e?.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "jwt expired" });
      }
      return res.status(401).json({ success: false, message: "jwt invalid" });
    }

    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: "jwt invalid" });
    }

    // 3) تحميل المستخدم من قاعدة البيانات
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "المستخدم غير موجود" });
    }

    // 4) التحقق من قفل الحساب
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: "🔒 تم قفل حسابك مؤقتاً. حاول مرة أخرى لاحقاً."
      });
    }

    // 5) التحقق من حالة الحساب
    if (user.status !== "active") {
      let reason = "🚫 حسابك غير نشط";
      if (user.status === "pending") reason = "⚠️ حسابك بانتظار التفعيل";
      if (user.status === "suspended") reason = "🚫 تم إيقاف حسابك من قبل الإدارة";
      if (user.status === "banned") reason = "❌ تم حظر حسابك نهائياً";
      return res.status(403).json({ success: false, message: reason });
    }

    // 6) تمرير بيانات المستخدم للطلبات اللاحقة
    req.user = user;

    return next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    // احتياطي: أعد رسالة موحّدة تساعد الفرونت
    return res
      .status(401)
      .json({ success: false, message: "jwt invalid" });
  }
};

/**
 * التحقق من صلاحية الدور
 * @param  {...string} roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "❌ ليس لديك صلاحية للوصول إلى هذا المسار" });
    }
    next();
  };
};

/**
 * التحقق من حالة الاشتراك النشط
 * يستخدم للمسارات التي تتطلب اشتراك نشط
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول أولاً"
      });
    }

    // تخطي التحقق للمشرفين
    if (req.user.role === 'admin') {
      return next();
    }

    const subscription = await Subscription.findOne({
      userId: req.user._id
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "لا يوجد اشتراك. يرجى إنشاء اشتراك جديد."
      });
    }

    if (subscription.status !== 'active') {
      let message = "اشتراكك غير نشط.";
      switch(subscription.status) {
        case 'new':
        case 'pending_payment':
          message = "يرجى إكمال عملية الدفع لتفعيل اشتراكك.";
          break;
        case 'under_review':
          message = "اشتراكك قيد المراجعة. سيتم إشعارك عند الموافقة.";
          break;
        case 'expired':
          message = "انتهت صلاحية اشتراكك. يرجى التجديد.";
          break;
        case 'suspended':
          message = "تم إيقاف اشتراكك. تواصل مع الإدارة.";
          break;
      }
      return res.status(403).json({ success: false, message });
    }

    // التحقق من انتهاء الصلاحية
    if (subscription.isExpired) {
      // تحديث حالة الاشتراك إلى منتهي
      subscription.status = 'expired';
      await subscription.save();

      return res.status(403).json({
        success: false,
        message: "انتهت صلاحية اشتراكك. يرجى التجديد."
      });
    }

    // إضافة معلومات الاشتراك للطلب
    req.subscription = subscription;

    return next();

  } catch (error) {
    console.error("Subscription Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "خطأ في التحقق من الاشتراك"
    });
  }
};

/**
 * التحقق من صلاحية الدور مع مرونة إضافية
 */
const authorizeRolesAdvanced = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول أولاً"
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `ليس لديك صلاحية للوصول إلى هذا المسار. الأدوار المطلوبة: ${allowedRoles.join(', ')}`
        });
      }

      return next();

    } catch (error) {
      console.error("Role Authorization Error:", error);
      return res.status(500).json({
        success: false,
        message: "خطأ في التحقق من الصلاحيات"
      });
    }
  };
};

module.exports = {
  protect,
  authorizeRoles,
  authorizeRolesAdvanced,
  requireActiveSubscription
};
