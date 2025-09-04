// services/moderationActions.js
const ModerationLog = require('../models/ModerationLog');
const WaSession = require('../models/WaSession');
const Group = require('../models/Group');

/**
 * تنفيذ إجراءات المراقبة والحماية
 */
class ModerationActions {

  /**
   * تنفيذ الإجراء المناسب حسب نوع المخالفة
   * @param {Object} sock - اتصال WhatsApp
   * @param {Object} message - الرسالة المخالفة
   * @param {Object} violation - تفاصيل المخالفة
   * @param {String} userId - معرف المستخدم (مالك البوت)
   */
  static async executeAction(sock, message, violation, userId) {
    try {
      const action = violation.action || 'delete';
      let success = false;

      switch (action) {
        case 'delete':
          success = await this.deleteMessage(sock, message);
          break;
        
        case 'warn':
          success = await this.warnUser(sock, message, violation);
          break;
        
        case 'kick':
          success = await this.kickUser(sock, message, violation);
          break;
        
        case 'ban':
          success = await this.banUser(sock, message, violation);
          break;
        
        default:
          console.log(`إجراء غير معروف: ${action}`);
          return false;
      }

      if (success) {
        // تحديث الإحصائيات
        await this.updateStats(userId, message.from, action);
        
        // تسجيل نجاح الإجراء
        await this.logActionResult(message, userId, action, 'completed');
        
        console.log(`تم تنفيذ الإجراء ${action} بنجاح في القروب ${message.from}`);
      } else {
        // تسجيل فشل الإجراء
        await this.logActionResult(message, userId, action, 'failed');
        
        console.log(`فشل في تنفيذ الإجراء ${action} في القروب ${message.from}`);
      }

      return success;

    } catch (error) {
      console.error('خطأ في تنفيذ الإجراء:', error);
      await this.logActionResult(message, userId, violation.action, 'failed');
      return false;
    }
  }

  /**
   * حذف الرسالة المخالفة
   * @param {Object} sock - اتصال WhatsApp
   * @param {Object} message - الرسالة المراد حذفها
   * @returns {Boolean} نجح الحذف أم لا
   */
  static async deleteMessage(sock, message) {
    try {
      if (!message.key) {
        console.log('لا يمكن حذف الرسالة: مفتاح الرسالة غير موجود');
        return false;
      }

      await sock.sendMessage(message.from, { 
        delete: message.key 
      });

      console.log(`تم حذف الرسالة ${message.key.id} من القروب ${message.from}`);
      return true;

    } catch (error) {
      console.error('خطأ في حذف الرسالة:', error);
      return false;
    }
  }

  /**
   * إرسال تحذير للمستخدم
   * @param {Object} sock - اتصال WhatsApp
   * @param {Object} message - الرسالة المخالفة
   * @param {Object} violation - تفاصيل المخالفة
   * @returns {Boolean} نجح الإرسال أم لا
   */
  static async warnUser(sock, message, violation) {
    try {
      const senderId = message.author || message.participant;
      const warningText = `⚠️ تحذير!\n\nتم كشف كلمة محظورة في رسالتك: "${violation.detectedWord}"\n\nيرجى الالتزام بقوانين القروب.`;

      // حذف الرسالة أولاً
      await this.deleteMessage(sock, message);

      // إرسال التحذير في القروب
      await sock.sendMessage(message.from, {
        text: warningText,
        mentions: [senderId]
      });

      console.log(`تم إرسال تحذير للمستخدم ${senderId} في القروب ${message.from}`);
      return true;

    } catch (error) {
      console.error('خطأ في إرسال التحذير:', error);
      return false;
    }
  }

  /**
   * طرد المستخدم من القروب
   * @param {Object} sock - اتصال WhatsApp
   * @param {Object} message - الرسالة المخالفة
   * @param {Object} violation - تفاصيل المخالفة
   * @returns {Boolean} نجح الطرد أم لا
   */
  static async kickUser(sock, message, violation) {
    try {
      const senderId = message.author || message.participant;
      
      // حذف الرسالة أولاً
      await this.deleteMessage(sock, message);

      // طرد المستخدم
      await sock.groupParticipantsUpdate(
        message.from,
        [senderId],
        'remove'
      );

      // إرسال رسالة إعلامية
      const kickMessage = `🚫 تم طرد المستخدم لمخالفة قوانين القروب\n\nالسبب: استخدام كلمة محظورة "${violation.detectedWord}"`;
      
      await sock.sendMessage(message.from, {
        text: kickMessage
      });

      console.log(`تم طرد المستخدم ${senderId} من القروب ${message.from}`);
      return true;

    } catch (error) {
      console.error('خطأ في طرد المستخدم:', error);
      
      // إذا فشل الطرد، نرسل تحذير بدلاً من ذلك
      return await this.warnUser(sock, message, violation);
    }
  }

  /**
   * حظر المستخدم (طرد + منع الإضافة مرة أخرى)
   * @param {Object} sock - اتصال WhatsApp
   * @param {Object} message - الرسالة المخالفة
   * @param {Object} violation - تفاصيل المخالفة
   * @returns {Boolean} نجح الحظر أم لا
   */
  static async banUser(sock, message, violation) {
    try {
      const senderId = message.author || message.participant;
      
      // حذف الرسالة أولاً
      await this.deleteMessage(sock, message);

      // طرد المستخدم
      await sock.groupParticipantsUpdate(
        message.from,
        [senderId],
        'remove'
      );

      // إضافة المستخدم لقائمة المحظورين في القروب
      await this.addToBanList(message.from, senderId, violation);

      // إرسال رسالة إعلامية
      const banMessage = `🔒 تم حظر المستخدم نهائياً من القروب\n\nالسبب: استخدام كلمة محظورة "${violation.detectedWord}"`;
      
      await sock.sendMessage(message.from, {
        text: banMessage
      });

      console.log(`تم حظر المستخدم ${senderId} من القروب ${message.from}`);
      return true;

    } catch (error) {
      console.error('خطأ في حظر المستخدم:', error);
      
      // إذا فشل الحظر، نحاول الطرد
      return await this.kickUser(sock, message, violation);
    }
  }

  /**
   * إضافة مستخدم لقائمة المحظورين في القروب
   * @param {String} groupId - معرف القروب
   * @param {String} userId - معرف المستخدم
   * @param {Object} violation - تفاصيل المخالفة
   */
  static async addToBanList(groupId, userId, violation) {
    try {
      const group = await Group.findOne({ jid: groupId });
      
      if (group) {
        if (!group.bannedUsers) {
          group.bannedUsers = [];
        }

        // التحقق من عدم وجود المستخدم في القائمة مسبقاً
        const existingBan = group.bannedUsers.find(ban => ban.userId === userId);
        
        if (!existingBan) {
          group.bannedUsers.push({
            userId: userId,
            reason: `كلمة محظورة: ${violation.detectedWord}`,
            bannedAt: new Date(),
            severity: violation.severity
          });

          await group.save();
          console.log(`تم إضافة ${userId} لقائمة المحظورين في القروب ${groupId}`);
        }
      }

    } catch (error) {
      console.error('خطأ في إضافة المستخدم لقائمة المحظورين:', error);
    }
  }

  /**
   * تحديث إحصائيات المراقبة
   * @param {String} userId - معرف المستخدم (مالك البوت)
   * @param {String} groupId - معرف القروب
   * @param {String} action - نوع الإجراء
   */
  static async updateStats(userId, groupId, action) {
    try {
      // تحديث إحصائيات الجلسة
      const session = await WaSession.findOne({ user: userId });
      if (session) {
        await session.updateStats('violation');
        
        if (action === 'kick' || action === 'ban') {
          await session.updateStats('kick');
        }
        
        if (action === 'delete') {
          await session.updateStats('delete');
        }
      }

      // تحديث إحصائيات القروب
      const group = await Group.findOne({ user: userId, jid: groupId });
      if (group) {
        await group.updateStats('violation');
        
        if (action === 'kick' || action === 'ban') {
          group.kicks = (group.kicks || 0) + 1;
          await group.save();
        }
      }

    } catch (error) {
      console.error('خطأ في تحديث الإحصائيات:', error);
    }
  }

  /**
   * تسجيل نتيجة تنفيذ الإجراء
   * @param {Object} message - الرسالة
   * @param {String} userId - معرف المستخدم
   * @param {String} action - نوع الإجراء
   * @param {String} status - حالة التنفيذ
   */
  static async logActionResult(message, userId, action, status) {
    try {
      // البحث عن السجل الموجود وتحديثه
      const existingLog = await ModerationLog.findOne({
        userId: userId,
        'messageMeta.messageId': message.id?.id || '',
        action: action
      }).sort({ createdAt: -1 });

      if (existingLog) {
        await existingLog.updateStatus(status);
      }

    } catch (error) {
      console.error('خطأ في تسجيل نتيجة الإجراء:', error);
    }
  }

  /**
   * التحقق من صلاحيات البوت في القروب
   * @param {Object} sock - اتصال WhatsApp
   * @param {String} groupId - معرف القروب
   * @returns {Object} الصلاحيات المتاحة
   */
  static async checkBotPermissions(sock, groupId) {
    try {
      const groupMetadata = await sock.groupMetadata(groupId);
      const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      
      const botParticipant = groupMetadata.participants.find(
        p => p.id === botNumber
      );

      return {
        isAdmin: botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin',
        canDelete: true, // عادة متاح للجميع
        canKick: botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin',
        canChangeSettings: botParticipant?.admin === 'superadmin'
      };

    } catch (error) {
      console.error('خطأ في فحص صلاحيات البوت:', error);
      return {
        isAdmin: false,
        canDelete: true,
        canKick: false,
        canChangeSettings: false
      };
    }
  }
}

module.exports = ModerationActions;
