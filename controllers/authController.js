const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const sessionService = require('../services/sessionService');

// ==================== دوال مساعدة ==================== //

// تنسيق رقم الجوال (يمني / سعودي)
const formatPhoneNumber = (phone) => {
  let formatted = phone.trim().replace(/\s+/g, ''); // إزالة المسافات

  // إذا كان الرقم يبدأ بـ 7 (يمني محلي)
  if (/^7\d{8,9}$/.test(formatted)) {
    formatted = `+967${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ 05 (سعودي محلي)
  else if (/^05\d{8}$/.test(formatted)) {
    formatted = `+966${formatted.substring(1)}`;
  }
  // إذا كان الرقم يبدأ بـ 967 (يمني بدون +)
  else if (/^967\d{9}$/.test(formatted)) {
    formatted = `+${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ 966 (سعودي بدون +)
  else if (/^966\d{9}$/.test(formatted)) {
    formatted = `+${formatted}`;
  }
  // إذا كان الرقم يبدأ بـ +967 أو +966 (صيغة دولية صحيحة)
  else if (/^\+967\d{9}$/.test(formatted) || /^\+966\d{9}$/.test(formatted)) {
    formatted = formatted; // لا تغيير
  }

  return formatted;
};

// إنشاء Access Token
const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

// إنشاء Refresh Token
const generateRefreshToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

// ==================== تسجيل مستخدم جديد ==================== //
const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    console.log("📥 registerUser بيانات مستلمة:", req.body);

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: '❌ الرجاء تعبئة جميع الحقول' });
    }

    // التحقق من صيغة البريد
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: '❌ صيغة البريد الإلكتروني غير صحيحة' });
    }

    // تنسيق والتحقق من رقم الجوال
    const formattedPhone = formatPhoneNumber(phone);
    const phoneRegex = /^(\+9677\d{8,9}|\+9665\d{8})$/;
    if (!phoneRegex.test(formattedPhone)) {
      return res.status(400).json({ success: false, message: '❌ رقم الجوال غير صحيح (يجب أن يكون يمني أو سعودي)' });
    }

    // التحقق من عدم التكرار
    if (await User.findOne({ email: email.trim().toLowerCase() })) {
      return res.status(400).json({ success: false, message: '❌ هذا البريد الإلكتروني مسجل بالفعل' });
    }
    if (await User.findOne({ phone: formattedPhone })) {
      return res.status(400).json({ success: false, message: '❌ هذا الرقم مسجل بالفعل' });
    }

    // إنشاء مستخدم جديد
    const newUser = new User({
      name,
      email: email.trim().toLowerCase(),
      phone: formattedPhone,
      password,
      role: 'user',
      status: 'pending' // استخدام الحالات الجديدة
    });

    await newUser.save();

    // إنشاء اشتراك أولي
    const newSubscription = new Subscription({
      userId: newUser._id,
      plan: 'شهري', // افتراضي
      status: 'new'
    });

    await newSubscription.save();

    // إنشاء إشعار ترحيب
    await Notification.createNotification({
      toUserId: newUser._id,
      type: 'welcome',
      title: 'مرحباً بك!',
      body: 'تم إنشاء حسابك بنجاح. يرجى إكمال عملية الاشتراك ورفع إثبات الدفع.',
      priority: 'normal'
    });

    res.status(201).json({
      success: true,
      message: '✅ تم إنشاء الحساب بنجاح! يرجى إكمال عملية الاشتراك.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone
      }
    });

  } catch (error) {
    console.error("❌ registerUser error:", error);
    res.status(500).json({ success: false, message: '❌ خطأ في السيرفر' });
  }
};

// ==================== تسجيل الدخول ==================== //
const loginUser = async (req, res) => {
  try {
    console.log("📥 loginUser بيانات مستلمة:", req.body);

    const { phone, password, role } = req.body;

    if (!phone || !password) {
      console.log("⚠️ الحقول ناقصة");
      return res.status(400).json({ success: false, message: '❌ الرجاء إدخال رقم الجوال وكلمة المرور' });
    }

    // تنسيق رقم الجوال
    const formattedPhone = formatPhoneNumber(phone);
    console.log("📞 الرقم بعد التنسيق:", formattedPhone);

    // البحث عن المستخدم
    const user = await User.findOne({ phone: formattedPhone });
    console.log("👤 نتيجة البحث عن المستخدم:", user ? user._id : "❌ غير موجود");

    if (!user) {
      return res.status(400).json({ success: false, message: '❌ رقم الجوال أو كلمة المرور غير صحيحة' });
    }

    // التحقق من كلمة المرور
    const isMatch = await user.matchPassword(password);
    console.log("🔑 كلمة المرور متطابقة:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: '❌ رقم الجوال أو كلمة المرور غير صحيحة' });
    }

    // التحقق من قفل الحساب
    if (user.isLocked) {
      await user.recordFailedLogin();
      return res.status(423).json({
        success: false,
        message: '🔒 تم قفل حسابك مؤقتاً بسبب محاولات دخول متكررة. حاول مرة أخرى لاحقاً.'
      });
    }

    // التحقق من حالة الحساب
    console.log("📌 حالة الحساب:", user.status);

    // السماح للمستخدمين pending بالدخول لإكمال عملية الاشتراك
    const allowedStatuses = ['active', 'pending'];

    if (!allowedStatuses.includes(user.status)) {
      await user.recordFailedLogin();
      let reason = "🚫 حسابك غير نشط";
      if (user.status === "suspended") reason = "🚫 تم إيقاف حسابك من قبل الإدارة";
      if (user.status === "banned") reason = "❌ تم حظر حسابك نهائياً";
      return res.status(403).json({ success: false, message: reason });
    }

    // جلب معلومات الاشتراك (للمستخدمين العاديين فقط، ليس للمدير)
    let subscription = null;
    if (user.role !== 'admin') {
      subscription = await Subscription.findOne({
        userId: user._id
      }).sort({ createdAt: -1 });
    }

    // ✅ السماح بتسجيل الدخول لجميع المستخدمين النشطين والـ pending
    // Frontend سيتولى توجيههم للصفحة المناسبة حسب حالة الاشتراك

    // التحقق من الدور إذا أرسل من الواجهة
    console.log("🎭 الدور المرسل:", role, "| الدور الفعلي:", user.role);
    if (role && role !== user.role) {
      return res.status(403).json({
        success: false,
        message: `🚫 ليس لديك صلاحية الدخول كـ "${role}"، حسابك مسجل كـ "${user.role}"`
      });
    }

    // تسجيل دخول ناجح
    await user.recordSuccessfulLogin(req.ip);

    // إنشاء جلسة جديدة مع إدارة محسنة
    console.log("✅ إنشاء جلسة جديدة...");
    const sessionData = await sessionService.createSession(user._id, req, '7d');

    // إنشاء Access Token
    const accessToken = generateAccessToken(user._id, user.role);

    // حفظ الـ Refresh Token في Cookie آمن
    res.cookie("refreshToken", sessionData.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // حفظ Session ID في Cookie منفصل للتتبع
    res.cookie("sessionId", sessionData.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log("🚀 تسجيل الدخول ناجح");

    // إعداد الاستجابة
    const response = {
      success: true,
      message: '✅ تسجيل الدخول ناجح',
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    };

    // إضافة معلومات الاشتراك فقط للمستخدمين العاديين
    if (user.role !== 'admin' && subscription) {
      response.subscription = {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        expiresAt: subscription.expiresAt
      };
    }

    console.log("📤 إرسال الاستجابة:", response);
    res.status(200).json(response);

  } catch (error) {
    console.error("❌ loginUser error:", error);
    res.status(500).json({ success: false, message: '❌ خطأ في السيرفر', error: error.message });
  }
};

// ==================== تجديد التوكن ==================== //
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const sessionId = req.cookies.sessionId;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "❌ لا يوجد Refresh Token" });
    }

    // التحقق من صحة الجلسة باستخدام الخدمة الجديدة
    const { session, user } = await sessionService.validateSession(refreshToken);

    if (!session || !user) {
      return res.status(401).json({ success: false, message: "❌ جلسة غير صالحة" });
    }

    // تحديث نشاط الجلسة
    if (sessionId) {
      await sessionService.updateSession(sessionId, req);
    }

    // إنشاء Access Token جديد
    const newAccessToken = generateAccessToken(user._id, user.role);

    res.json({
      success: true,
      token: newAccessToken,
      sessionInfo: {
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ خطأ في تجديد التوكن:', error.message);
    return res.status(403).json({ success: false, message: "❌ Refresh Token غير صالح أو منتهي" });
  }
};

// ==================== التحقق من حالة المستخدم ==================== //
const checkUserStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const subscription = await Subscription.findOne({
      userId: userId
    }).sort({ createdAt: -1 });

    const unreadNotifications = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        profile: user.profile,
        stats: user.stats
      },
      subscription: subscription ? {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        isExpired: subscription.isExpired,
        isExpiringSoon: subscription.isExpiringSoon
      } : null,
      notifications: {
        unreadCount: unreadNotifications
      }
    });

  } catch (error) {
    console.error("❌ checkUserStatus error:", error);
    res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// ==================== تسجيل الخروج ==================== //
const logoutUser = async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    const refreshToken = req.cookies.refreshToken;

    // إبطال الجلسة الحالية
    if (sessionId) {
      await sessionService.revokeSession(sessionId, 'logout');
    }

    // مسح الكوكيز
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict"
    });

    res.clearCookie('sessionId', {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict"
    });

    console.log('✅ تم تسجيل الخروج بنجاح');
    res.json({
      success: true,
      message: '✅ تم تسجيل الخروج بنجاح'
    });

  } catch (error) {
    console.error("❌ logoutUser error:", error);
    res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// ==================== تسجيل الخروج من جميع الأجهزة ==================== //
const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentSessionId = req.cookies.sessionId;

    // إبطال جميع الجلسات ما عدا الحالية (اختياري)
    const revokedCount = await sessionService.revokeAllUserSessions(
      userId,
      'logout_all_devices',
      currentSessionId
    );

    // مسح الكوكيز
    res.clearCookie('refreshToken');
    res.clearCookie('sessionId');

    console.log(`✅ تم تسجيل الخروج من ${revokedCount} جهاز`);
    res.json({
      success: true,
      message: `✅ تم تسجيل الخروج من ${revokedCount} جهاز`,
      revokedSessions: revokedCount
    });

  } catch (error) {
    console.error('❌ خطأ في تسجيل الخروج من جميع الأجهزة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تسجيل الخروج من جميع الأجهزة'
    });
  }
};

// ==================== الحصول على الجلسات النشطة ==================== //
const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const sessions = await sessionService.getUserActiveSessions(userId);

    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isCurrentSession: session.sessionId === req.cookies.sessionId
    }));

    res.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length
    });

  } catch (error) {
    console.error('❌ خطأ في جلب الجلسات النشطة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الجلسات النشطة'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  checkUserStatus,
  logoutUser,
  logoutAllDevices,
  getActiveSessions
};
