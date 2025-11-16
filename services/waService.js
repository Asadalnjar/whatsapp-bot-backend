// services/waService.js
// =====================
// إدارة جلسات واتساب عبر Baileys + Socket.IO
// - يبث QR كـ DataURL للفرونت
// - يعالج إعادة الاتصال
// - يشخّص فساد حالة الاعتماد ويعيد تهيئتها
// - يدعم إدارة القروبات (مزامنة/انضمام/مغادرة/إرسال)

const makeWASocket = require("@whiskeysockets/baileys").default;
const { fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { useMongoDBAuthState, resetMongoDBAuthState } = require("./waMongoAuth");
const Boom = require("@hapi/boom");
const QRCode = require("qrcode");
const pino = require("pino");

// 🔒 منطق الحماية الجديد (فلترة الرسائل والإجراءات)
const MessageFilter = require("./messageFilter");
const ModerationActions = require("./moderationActions");

// ✅ لدمج حالة الحماية من قاعدة البيانات
const GroupModel = require("../models/Group");

// ✅ لتخزين رقم المالك تلقائيًا بعد مسح الـQR
const AdminSettings = require("../models/AdminSettings");

// مرجع Socket.IO
let ioRef = null;

// الجلسات: userId -> { sock }
const sessions = new Map();

// ===== Init =====
function init(io) {
  ioRef = io;
}

// ===== Helpers =====
function emitToUser(userId, event, payload) {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

async function safeStopSession(userId) {
  const entry = sessions.get(String(userId));
  if (!entry?.sock) {
    sessions.delete(String(userId));
    return;
  }
  const sock = entry.sock;

  try {
    sock.ev.removeAllListeners?.();
    try {
      sock.ws?.on?.("error", () => {});
    } catch (_) {}

    if (typeof sock.end === "function") {
      await sock.end(new Error("manual stop"));
    } else if (typeof sock.logout === "function") {
      await sock.logout();
    }
  } catch (_) {
    // تجاهل أي خطأ عند الإيقاف
  } finally {
    sessions.delete(String(userId));
  }
}

function authStateLooksBroken(state) {
  const c = state?.creds;
  return (
    !c?.noiseKey?.private ||
    !c?.signedIdentityKey?.private ||
    !c?.signedPreKey?.keyPair?.private
  );
}

// مرجع السوكِت الحالي لمستخدم
function getSock(userId) {
  const entry = sessions.get(String(userId));
  if (!entry?.sock) throw new Error("Session not ready");
  return entry.sock;
}

// ===== Core =====
async function startSession(user) {
  if (!user?._id) throw new Error("User is required to start session");
  const userId = String(user._id);

  // أوقف جلسة سابقة إن وجدت
  await safeStopSession(userId);

  // حالة الاعتماد من Mongo
  let { state, saveCreds } = await useMongoDBAuthState(userId);

  // لو بدت تالفة — صفّرها
  if (authStateLooksBroken(state)) {
    await resetMongoDBAuthState(userId);
    ({ state, saveCreds } = await useMongoDBAuthState(userId));
  }

  // نسخة البروتوكول
  const { version } = await fetchLatestBaileysVersion();

  // إنشاء سوكِت Baileys
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ["Bot", "Chrome", "121"],
    syncFullHistory: false,
    logger: pino({ level: "warn" }),
    connectTimeoutMs: 30_000,
    defaultQueryTimeoutMs: 60_000,
  });

  // تجنّب Unhandled 'error' على WS
  try {
    sock.ws?.on?.("error", () => {});
  } catch (_) {}

  sessions.set(userId, { sock });

  // حفظ الاعتمادات
  sock.ev.on("creds.update", saveCreds);

  // اتصال/QR/إغلاق
  sock.ev.on("connection.update", async (u) => {
    try {
      const {
        connection,
        qr,
        lastDisconnect,
        isOnline,
        receivedPendingNotifications,
      } = u;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr);
          emitToUser(userId, "wa:qr", { qr: dataUrl, format: "dataurl" });
        } catch {
          emitToUser(userId, "wa:qr", { qr, format: "raw" });
        }
        emitToUser(userId, "wa:status", "AWAITING_SCAN");
      }

      if (connection === "open") {
        emitToUser(userId, "wa:status", "READY");

        // ✅ تحديث حالة WaSession إلى متصلة
        try {
          const WaSession = require("../models/WaSession");
          await WaSession.findOneAndUpdate(
            { user: userId },
            {
              state: 'connected',
              lastSeenAt: new Date()
            },
            { upsert: true }
          );
          console.log(`✅ تم تحديث حالة WaSession للمستخدم ${userId} إلى متصلة`);
        } catch (e) {
          console.warn("WaSession update failed:", e?.message || e);
        }

        // ✅ تعرّف على رقم الحساب الحالي (الذي مسح الـQR) واحفظه كمالك
        try {
          const meJid = sock?.user?.id || sock?.user?.jid || "";
          const meNum = String(meJid).replace(/\D/g, ""); // أرقام فقط

          if (meNum) {
            await AdminSettings.findOneAndUpdate(
              {},
              {
                $set: { ownerNumber: meNum },
                $addToSet: { whitelistNumbers: meNum },
              },
              { upsert: true, new: true }
            );
            emitToUser(userId, "wa:owner", { number: meNum }); // اختياري للواجهة
          }
        } catch (e) {
          console.warn("ownerNumber auto-set failed:", e?.message || e);
        }
      }

      if (connection === "close") {
        const isAuthErr =
          lastDisconnect?.error && Boom.isBoom(lastDisconnect.error)
            ? lastDisconnect.error.output.statusCode === 401
            : false;

        emitToUser(userId, "wa:status", "DISCONNECTED");

        // ✅ تحديث حالة WaSession إلى منقطعة
        try {
          const WaSession = require("../models/WaSession");
          await WaSession.findOneAndUpdate(
            { user: userId },
            {
              state: 'disconnected',
              lastSeenAt: new Date()
            }
          );
          console.log(`⚠️ تم تحديث حالة WaSession للمستخدم ${userId} إلى منقطعة`);
        } catch (e) {
          console.warn("WaSession disconnect update failed:", e?.message || e);
        }

        if (!isAuthErr) {
          // محاولة إعادة الاتصال
          setTimeout(() => {
            startSession(user).catch((e) => {
              console.error("Re-start session failed:", e?.message || e);
              emitToUser(userId, "wa:status", "RECONNECT_FAILED");
            });
          }, 2000);
        }
      }

      if (typeof isOnline === "boolean") {
        emitToUser(userId, "wa:online", { isOnline });
      }
      if (typeof receivedPendingNotifications === "boolean") {
        emitToUser(userId, "wa:pending", { receivedPendingNotifications });
      }
    } catch (err) {
      console.error("connection.update handler error:", err?.message || err);
      emitToUser(userId, "wa:status", "ERROR");
    }
  });

  // رسائل واردة: منطق الحماية + بث (اختياري)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    try {
      if (type !== "notify" || !Array.isArray(messages)) return;

      for (const msg of messages) {
        // تجاهل الرسائل المرسلة من البوت نفسه
        if (msg.key?.fromMe === true) continue;

        // معالجة رسائل القروبات فقط
        if (msg.key?.remoteJid?.includes("@g.us")) {
          try {
            await handleGroupMessage(sock, msg, userId);
          } catch (e) {
            console.error("handleGroupMessage error:", e?.message || e);
          }
        }

        // 2) (اختياري) بث الرسالة للواجهة
        // emitToUser(userId, "wa:message", msg);
      }
    } catch (err) {
      console.error("messages.upsert handler error:", err?.message || err);
    }
  });

  return sock;
}

function getStatus(userId) {
  const entry = sessions.get(String(userId));
  if (!entry?.sock) return { connected: false, status: "INIT" };
  const connected = !!entry.sock.user;
  return { connected, status: connected ? "READY" : "INIT" };
}

async function sendTo(userId, toPhoneE164, text) {
  const sock = getSock(userId);
  const jid = String(toPhoneE164 || "").replace(/\+/g, "") + "@s.whatsapp.net";
  await sock.sendMessage(jid, { text: String(text || "").trim() });
}

/** إرسال رسالة جماعية إلى جميع القروبات المحمية */
async function sendToAllProtectedGroups(userId, text) {
  const sock = getSock(userId);
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('الرسالة مطلوبة');
  }

  // جلب القروبات المحمية من قاعدة البيانات
  const protectedGroups = await GroupModel.find({
    user: userId,
    isProtected: true
  }).select('jid name').lean();

  if (protectedGroups.length === 0) {
    throw new Error('لا توجد قروبات محمية لإرسال الرسالة إليها');
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  // إرسال الرسالة لكل قروب محمي
  for (const group of protectedGroups) {
    try {
      await sock.sendMessage(group.jid, { text: text.trim() });
      results.push({
        jid: group.jid,
        name: group.name,
        status: 'success'
      });
      successCount++;
      console.log(`✅ تم إرسال الرسالة إلى القروب: ${group.name}`);
    } catch (error) {
      results.push({
        jid: group.jid,
        name: group.name,
        status: 'error',
        error: error.message
      });
      failCount++;
      console.error(`❌ فشل في إرسال الرسالة إلى القروب ${group.name}:`, error.message);
    }
  }

  return {
    successCount,
    failCount,
    totalGroups: protectedGroups.length,
    results
  };
}

// ===== Groups APIs =====

/** جلب كل القروبات التي يشارك فيها الحساب + دمج حالة الحماية من الـDB */
async function fetchAllGroups(userId) {
  const sock = getSock(userId);
  const participating = await sock.groupFetchAllParticipating(); // { jid: meta }

  // 1) نبني قائمة من واتساب
  const list = Object.values(participating || {}).map((g) => ({
    id: g.id,            // jid
    jid: g.id,           // نعيدها صراحةً للاستخدام في الواجهة
    name: g.subject,
    size: g.participants?.length || 0,
    isAnnounce: !!g.announce,
    isLocked: !!g.restrict,
  }));

  // 2) نقرأ حالات الحماية من DB لهذا المستخدم
  const docs = await GroupModel
    .find({ user: userId, jid: { $in: list.map((x) => x.jid) } })
    .select({ jid: 1, isProtected: 1 })
    .lean();

  const protectMap = new Map(docs.map((d) => [d.jid, !!d.isProtected]));

  // 3) ندمج الحالة
  for (const g of list) {
    g.isProtected = protectMap.get(g.jid) || false;
    g.protectionEnabled = g.isProtected; // للتوافق مع الواجهة
  }

  list.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ar")
  );
  return list;
}

/** الانضمام إلى قروب عبر رابط دعوة عام */
async function joinGroupByInvite(userId, inviteLink) {
  const sock = getSock(userId);
  if (typeof inviteLink !== "string") throw new Error("Invalid invite link");
  const m = inviteLink.trim().match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  if (!m) throw new Error("Invalid WhatsApp group link");
  const code = m[1];
  const jid = await sock.groupAcceptInvite(code);
  return { jid };
}

/** مغادرة قروب */
async function leaveGroup(userId, groupJid) {
  const sock = getSock(userId);
  if (!groupJid?.endsWith("@g.us")) throw new Error("Invalid group JID");
  await sock.groupLeave(groupJid);
  return { ok: true };
}

/** إرسال رسالة نصية إلى قروب */
async function sendToGroup(userId, groupJid, text) {
  const sock = getSock(userId);
  if (!groupJid?.endsWith("@g.us")) throw new Error("Invalid group JID");
  await sock.sendMessage(groupJid, { text: String(text || "").trim() });
  return { ok: true };
}

/**
 * معالجة رسائل القروبات وتطبيق نظام الحماية
 * @param {Object} sock - اتصال WhatsApp
 * @param {Object} message - الرسالة الواردة
 * @param {String} userId - معرف المستخدم (مالك البوت)
 */
async function handleGroupMessage(sock, message, userId) {
  try {
    // إنشاء كائن رسالة متوافق مع نظام الفلترة
    const formattedMessage = {
      id: message.key,
      key: message.key,
      from: message.key.remoteJid,
      author: message.key.participant,
      participant: message.key.participant,
      body: message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption || '',
      timestamp: message.messageTimestamp,
      pushName: message.pushName,
      chat: {
        name: 'Unknown Group' // يمكن تحسينه لاحقاً
      }
    };

    // فحص الرسالة ضد قواعد الحماية
    const filterResult = await MessageFilter.checkMessage(formattedMessage, userId);

    if (filterResult.isViolation) {
      console.log(`🚫 تم كشف مخالفة في القروب ${formattedMessage.from}:`, {
        word: filterResult.detectedWord,
        severity: filterResult.severity,
        action: filterResult.action
      });

      // تنفيذ الإجراء المناسب
      const actionResult = await ModerationActions.executeAction(
        sock,
        formattedMessage,
        filterResult,
        userId
      );

      if (actionResult) {
        console.log(`✅ تم تنفيذ الإجراء ${filterResult.action} بنجاح`);

        // إرسال إشعار للمستخدم عبر Socket.IO
        emitToUser(userId, "wa:violation", {
          groupId: formattedMessage.from,
          groupName: formattedMessage.chat.name,
          violationType: filterResult.violationType,
          detectedWord: filterResult.detectedWord,
          action: filterResult.action,
          severity: filterResult.severity,
          timestamp: new Date()
        });
      } else {
        console.log(`❌ فشل في تنفيذ الإجراء ${filterResult.action}`);
      }
    }

  } catch (error) {
    console.error('خطأ في معالجة رسالة القروب:', error);
  }
}

module.exports = {
  init,
  startSession,
  stopSession: safeStopSession,
  getStatus,
  getSock,
  sendTo,
  // القروبات
  fetchAllGroups,
  joinGroupByInvite,
  leaveGroup,
  sendToGroup,
  handleGroupMessage
};
