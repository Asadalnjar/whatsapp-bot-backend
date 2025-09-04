// controllers/bannedWordsController.js
const BannedWord = require('../models/BannedWord');
const WaSession = require('../models/WaSession');

/**
 * @desc   الحصول على جميع الكلمات المحظورة للمستخدم
 * @route  GET /user/banned-words
 * @access User
 */
const getBannedWords = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('🔍 جلب الكلمات المحظورة للمستخدم:', userId);

    const bannedWords = await BannedWord.findActiveByUser(userId);
    console.log('📊 عدد الكلمات المحظورة:', bannedWords.length);

    res.json({
      success: true,
      words: bannedWords.map(word => ({
        _id: word._id,
        word: word.word,
        type: word.type,
        severity: word.severity,
        action: word.action,
        isActive: word.isActive,
        detectionCount: word.detectionCount,
        lastDetectedAt: word.lastDetectedAt,
        notes: word.notes,
        createdAt: word.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ getBannedWords error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   إضافة كلمة محظورة جديدة
 * @route  POST /user/banned-words
 * @access User
 */
const addBannedWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { word, type, severity, action, notes } = req.body;

    // التحقق من البيانات المطلوبة
    if (!word || word.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'الكلمة المحظورة مطلوبة'
      });
    }

    // التحقق من عدم وجود الكلمة مسبقاً
    const existingWord = await BannedWord.findOne({
      userId,
      word: word.trim().toLowerCase()
    });

    if (existingWord) {
      return res.status(400).json({
        success: false,
        message: 'هذه الكلمة محظورة بالفعل'
      });
    }

    // إنشاء كلمة محظورة جديدة
    const newBannedWord = new BannedWord({
      userId,
      word: word.trim().toLowerCase(),
      type: type || 'contains',
      severity: severity || 'medium',
      action: action || 'delete',
      notes: notes || ''
    });

    await newBannedWord.save();

    res.status(201).json({
      success: true,
      message: 'تم إضافة الكلمة المحظورة بنجاح',
      bannedWord: {
        id: newBannedWord._id,
        word: newBannedWord.word,
        type: newBannedWord.type,
        severity: newBannedWord.severity,
        action: newBannedWord.action,
        notes: newBannedWord.notes
      }
    });

  } catch (error) {
    console.error('❌ addBannedWord error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   تحديث كلمة محظورة
 * @route  PUT /user/banned-words/:id
 * @access User
 */
const updateBannedWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { word, type, severity, action, notes, isActive } = req.body;

    const bannedWord = await BannedWord.findOne({
      _id: id,
      userId
    });

    if (!bannedWord) {
      return res.status(404).json({
        success: false,
        message: 'الكلمة المحظورة غير موجودة'
      });
    }

    // تحديث البيانات
    if (word !== undefined) bannedWord.word = word.trim().toLowerCase();
    if (type !== undefined) bannedWord.type = type;
    if (severity !== undefined) bannedWord.severity = severity;
    if (action !== undefined) bannedWord.action = action;
    if (notes !== undefined) bannedWord.notes = notes;
    if (isActive !== undefined) bannedWord.isActive = isActive;

    await bannedWord.save();

    res.json({
      success: true,
      message: 'تم تحديث الكلمة المحظورة بنجاح',
      bannedWord: {
        id: bannedWord._id,
        word: bannedWord.word,
        type: bannedWord.type,
        severity: bannedWord.severity,
        action: bannedWord.action,
        isActive: bannedWord.isActive,
        notes: bannedWord.notes
      }
    });

  } catch (error) {
    console.error('❌ updateBannedWord error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   حذف كلمة محظورة
 * @route  DELETE /user/banned-words/:id
 * @access User
 */
const deleteBannedWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const bannedWord = await BannedWord.findOneAndDelete({
      _id: id,
      userId
    });

    if (!bannedWord) {
      return res.status(404).json({
        success: false,
        message: 'الكلمة المحظورة غير موجودة'
      });
    }

    res.json({
      success: true,
      message: 'تم حذف الكلمة المحظورة بنجاح'
    });

  } catch (error) {
    console.error('❌ deleteBannedWord error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   تفعيل/إلغاء تفعيل كلمة محظورة
 * @route  PATCH /user/banned-words/:id/toggle
 * @access User
 */
const toggleBannedWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const bannedWord = await BannedWord.findOne({
      _id: id,
      userId
    });

    if (!bannedWord) {
      return res.status(404).json({
        success: false,
        message: 'الكلمة المحظورة غير موجودة'
      });
    }

    await bannedWord.toggle();

    res.json({
      success: true,
      message: `تم ${bannedWord.isActive ? 'تفعيل' : 'إلغاء تفعيل'} الكلمة المحظورة`,
      isActive: bannedWord.isActive
    });

  } catch (error) {
    console.error('❌ toggleBannedWord error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   الحصول على إحصائيات الكلمات المحظورة
 * @route  GET /user/banned-words/stats
 * @access User
 */
const getBannedWordsStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await BannedWord.getStats(userId);

    res.json({
      success: true,
      stats: stats[0] || {
        totalWords: 0,
        activeWords: 0,
        totalDetections: 0,
        bySeverity: []
      }
    });

  } catch (error) {
    console.error('❌ getBannedWordsStats error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   تحديث إعدادات الحماية العامة
 * @route  PUT /user/protection/settings
 * @access User
 */
const updateProtectionSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      protectionEnabled, 
      autoKick, 
      autoDelete, 
      allowOwnerBypass, 
      warningBeforeKick,
      maxWarnings,
      muteBeforeKick,
      muteDuration
    } = req.body;

    const session = await WaSession.findOne({ user: userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'جلسة WhatsApp غير موجودة'
      });
    }

    // تحديث الإعدادات
    if (protectionEnabled !== undefined) {
      session.protectionEnabled = protectionEnabled;
    }

    if (autoKick !== undefined) {
      session.protectionSettings.autoKick = autoKick;
    }

    if (autoDelete !== undefined) {
      session.protectionSettings.autoDelete = autoDelete;
    }

    if (allowOwnerBypass !== undefined) {
      session.protectionSettings.allowOwnerBypass = allowOwnerBypass;
    }

    if (warningBeforeKick !== undefined) {
      session.protectionSettings.warningBeforeKick = warningBeforeKick;
    }

    if (maxWarnings !== undefined) {
      session.protectionSettings.maxWarnings = maxWarnings;
    }

    if (muteBeforeKick !== undefined) {
      session.protectionSettings.muteBeforeKick = muteBeforeKick;
    }

    if (muteDuration !== undefined) {
      session.protectionSettings.muteDuration = muteDuration;
    }

    await session.save();

    res.json({
      success: true,
      message: 'تم تحديث إعدادات الحماية بنجاح',
      settings: {
        protectionEnabled: session.protectionEnabled,
        protectionSettings: session.protectionSettings
      }
    });

  } catch (error) {
    console.error('❌ updateProtectionSettings error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

/**
 * @desc   الحصول على إعدادات الحماية
 * @route  GET /user/protection/settings
 * @access User
 */
const getProtectionSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const session = await WaSession.findOne({ user: userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'جلسة WhatsApp غير موجودة'
      });
    }

    res.json({
      success: true,
      settings: {
        protectionEnabled: session.protectionEnabled,
        protectionSettings: session.protectionSettings,
        stats: session.stats
      }
    });

  } catch (error) {
    console.error('❌ getProtectionSettings error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر'
    });
  }
};

module.exports = {
  getBannedWords,
  addBannedWord,
  updateBannedWord,
  deleteBannedWord,
  toggleBannedWord,
  getBannedWordsStats,
  updateProtectionSettings,
  getProtectionSettings
};
