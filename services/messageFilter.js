// services/messageFilter.js
const BannedWord = require('../models/BannedWord');
const WaSession = require('../models/WaSession');
const Group = require('../models/Group');
const ModerationLog = require('../models/ModerationLog');

/**
 * فلترة الرسائل الواردة وكشف المخالفات
 */
class MessageFilter {
  
  /**
   * فحص رسالة واردة ضد قواعد الحماية
   * @param {Object} message - الرسالة الواردة
   * @param {String} userId - معرف المستخدم (مالك البوت)
   * @returns {Object} نتيجة الفحص
   */
  static async checkMessage(message, userId) {
    try {
      console.log(`🔍 فحص رسالة من المستخدم ${userId} في القروب ${message.from}`);

      // التحقق من وجود جلسة نشطة
      const session = await WaSession.findOne({
        user: userId,
        state: 'connected'
      });

      console.log(`📊 حالة الجلسة: ${session ? 'موجودة' : 'غير موجودة'}, الحماية: ${session?.protectionEnabled ? 'مفعلة' : 'غير مفعلة'}`);

      if (!session || !session.protectionEnabled) {
        console.log(`⚠️ تم تجاهل الرسالة: ${!session ? 'جلسة غير موجودة' : 'الحماية غير مفعلة'}`);
        return {
          isViolation: false,
          reason: 'الحماية غير مفعلة'
        };
      }

      // التحقق من نوع الرسالة (فقط الرسائل النصية حالياً)
      if (!message.body || typeof message.body !== 'string') {
        return { 
          isViolation: false, 
          reason: 'ليست رسالة نصية' 
        };
      }

      // التحقق من أن الرسالة من قروب
      if (!message.from.includes('@g.us')) {
        return { 
          isViolation: false, 
          reason: 'ليست رسالة قروب' 
        };
      }

      // الحصول على معلومات القروب
      const group = await Group.findOne({
        user: userId,
        jid: message.from
      });

      if (!group || !group.isProtected) {
        return { 
          isViolation: false, 
          reason: 'القروب غير محمي' 
        };
      }

      // التحقق من الاستثناءات
      if (await this.isUserException(message, group, session)) {
        return {
          isViolation: false,
          reason: 'المستخدم في قائمة الاستثناءات'
        };
      }

      // فحص الكلمات المحظورة
      console.log(`📝 فحص النص: "${message.body}"`);
      const violationResult = await this.checkBannedWords(
        message.body,
        userId
      );

      if (violationResult.isViolation) {
        console.log(`🚫 تم كشف مخالفة: "${violationResult.word}" - الإجراء: ${violationResult.action}`);

        // تسجيل المخالفة
        await this.logViolation(message, userId, violationResult);

        return {
          isViolation: true,
          violationType: 'banned_word',
          detectedWord: violationResult.word,
          severity: violationResult.severity,
          action: violationResult.action,
          group: group
        };
      } else {
        console.log(`✅ لا توجد مخالفات في النص`);
      }

      return { 
        isViolation: false, 
        reason: 'لا توجد مخالفات' 
      };

    } catch (error) {
      console.error('خطأ في فلترة الرسالة:', error);
      return { 
        isViolation: false, 
        reason: 'خطأ في النظام' 
      };
    }
  }

  /**
   * فحص النص ضد الكلمات المحظورة
   * @param {String} text - النص المراد فحصه
   * @param {String} userId - معرف المستخدم
   * @returns {Object} نتيجة الفحص
   */
  static async checkBannedWords(text, userId) {
    try {
      const violations = await BannedWord.checkText(userId, text);
      
      if (violations.length > 0) {
        // ترتيب المخالفات حسب الشدة
        const sortedViolations = violations.sort((a, b) => {
          const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        });

        const topViolation = sortedViolations[0];
        
        return {
          isViolation: true,
          word: topViolation.word,
          type: topViolation.type,
          severity: topViolation.severity,
          action: topViolation.action,
          bannedWordId: topViolation.bannedWordId
        };
      }

      return { isViolation: false };

    } catch (error) {
      console.error('خطأ في فحص الكلمات المحظورة:', error);
      return { isViolation: false };
    }
  }

  /**
   * التحقق من كون المستخدم في قائمة الاستثناءات
   * @param {Object} message - الرسالة
   * @param {Object} group - معلومات القروب
   * @param {Object} session - جلسة المستخدم
   * @returns {Boolean}
   */
  static async isUserException(message, group, session) {
    const senderId = message.author || message.participant;
    console.log(`🔍 فحص الاستثناءات للمستخدم: ${senderId}`);

    // 1. التحقق من صاحب البوت نفسه
    if (session.protectionSettings.allowOwnerBypass) {
      try {
        const AdminSettings = require('../models/AdminSettings');
        const adminSettings = await AdminSettings.findOne({});

        if (adminSettings && adminSettings.ownerNumber) {
          const ownerJid = `${adminSettings.ownerNumber}@s.whatsapp.net`;
          const senderNumber = senderId.replace(/\D/g, '');
          const ownerNumber = adminSettings.ownerNumber.replace(/\D/g, '');

          if (senderNumber === ownerNumber) {
            console.log(`✅ تم استثناء صاحب البوت: ${senderId}`);
            return true;
          }
        }
      } catch (error) {
        console.warn('خطأ في فحص صاحب البوت:', error);
      }
    }

    // 2. التحقق من مشرفي القروب
    try {
      // الحصول على معلومات القروب من WhatsApp
      const WaService = require('./waService');
      const sessionUserId = session.user || userId;

      // محاولة الحصول على معلومات القروب
      const sock = WaService.getSock ? WaService.getSock(sessionUserId) : null;
      if (sock) {
        const groupMetadata = await sock.groupMetadata(message.from);

        // التحقق من كون المرسل مشرف أو مالك القروب
        const participant = groupMetadata.participants.find(p => p.id === senderId);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
          console.log(`✅ تم استثناء مشرف القروب: ${senderId}`);
          return true;
        }
      }
    } catch (error) {
      console.warn('خطأ في فحص مشرفي القروب:', error);
    }

    // 3. التحقق من قائمة الاستثناءات في القروب
    if (group.exceptions && group.exceptions.length > 0) {
      const isException = group.exceptions.some(exception =>
        exception.jid === senderId
      );
      if (isException) {
        console.log(`✅ تم استثناء المستخدم من قائمة الاستثناءات: ${senderId}`);
        return true;
      }
    }

    console.log(`❌ المستخدم ليس في الاستثناءات: ${senderId}`);
    return false;
  }

  /**
   * تسجيل المخالفة في قاعدة البيانات
   * @param {Object} message - الرسالة المخالفة
   * @param {String} userId - معرف المستخدم
   * @param {Object} violation - تفاصيل المخالفة
   */
  static async logViolation(message, userId, violation) {
    try {
      const Violation = require('../models/Violation');

      const newViolation = new Violation({
        user: userId,
        groupId: message.from,
        groupName: message.chat?.name || 'غير محدد',
        messageId: message.id?.id || '',
        messageContent: message.body,
        senderId: message.author || message.participant || message.from,
        senderName: message.pushName || 'غير محدد',
        violationType: 'banned_word',
        detectedWord: violation.word,
        severity: violation.severity,
        action: violation.action,
        reason: `كلمة محظورة: ${violation.word}`,
        automated: true,
        ruleId: violation.bannedWordId
      });

      await newViolation.save();
      console.log(`تم تسجيل مخالفة: ${violation.word} في القروب ${message.from}`);

    } catch (error) {
      console.error('خطأ في تسجيل المخالفة:', error);
    }
  }

  /**
   * فحص سريع للنص (بدون حفظ في قاعدة البيانات)
   * @param {String} text - النص المراد فحصه
   * @param {Array} bannedWords - قائمة الكلمات المحظورة
   * @returns {Object} نتيجة الفحص
   */
  static quickCheck(text, bannedWords) {
    if (!text || !bannedWords || bannedWords.length === 0) {
      return { isViolation: false };
    }

    const lowerText = text.toLowerCase();
    
    for (const wordObj of bannedWords) {
      const word = wordObj.word || wordObj;
      
      if (typeof word === 'string') {
        if (lowerText.includes(word.toLowerCase())) {
          return {
            isViolation: true,
            word: word,
            severity: wordObj.severity || 'medium',
            action: wordObj.action || 'delete'
          };
        }
      }
    }

    return { isViolation: false };
  }

  /**
   * تنظيف النص من الرموز والأرقام للفحص الأفضل
   * @param {String} text - النص الأصلي
   * @returns {String} النص المنظف
   */
  static cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/[0-9]/g, '') // إزالة الأرقام
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '') // الاحتفاظ بالعربية والمسافات فقط
      .replace(/\s+/g, ' ') // توحيد المسافات
      .trim();
  }

  /**
   * فحص متقدم يتضمن أنماط مختلفة من الكتابة
   * @param {String} text - النص المراد فحصه
   * @param {String} bannedWord - الكلمة المحظورة
   * @returns {Boolean}
   */
  static advancedMatch(text, bannedWord) {
    if (!text || !bannedWord) return false;

    const cleanedText = this.cleanText(text);
    const cleanedWord = this.cleanText(bannedWord);

    // فحص مباشر
    if (cleanedText.includes(cleanedWord)) {
      return true;
    }

    // فحص مع إزالة المسافات
    if (cleanedText.replace(/\s/g, '').includes(cleanedWord.replace(/\s/g, ''))) {
      return true;
    }

    // يمكن إضافة المزيد من أنماط الفحص هنا

    return false;
  }
}

module.exports = MessageFilter;
