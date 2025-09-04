// services/protectionService.js
const Group = require("../models/Group");
const AdminSettings = require("../models/AdminSettings");
const Violation = require("../models/Violation");
const { messageMatchesBanned } = require("../utils/text");

// ===== Debug =====
const DEBUG = String(process.env.DEBUG_PROTECTION || "").toLowerCase() === "true";
const dlog = (...a) => (DEBUG ? console.log("[protection]", ...a) : undefined);

// ===== تطبيع JID يدوي =====
function normalizeUserJid(anyJid = "") {
  // أمثلة واردة: "2715...@lid", "number@s.whatsapp.net", "number:device@s.whatsapp.net"
  const num = String(anyJid).replace(/\D/g, "");
  return num ? `${num}@s.whatsapp.net` : String(anyJid || "");
}

// ===== الإعدادات العامة =====
async function ensureSettings() {
  // استرجع وثيقة الإعدادات الفعلية
  let s = await AdminSettings.findOne().lean();
  if (!s) s = (await AdminSettings.create({})).toObject();
  return s;
}

// استثناءات (مالك أو whitelist) - تعتمد على DB أولًا ثم .env كنسخة احتياطية
const ENV_OWNER = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
const ENV_WHITELIST = (process.env.WHITELIST_NUMBERS || "")
  .split(",")
  .map((x) => x.replace(/\D/g, ""))
  .filter(Boolean);

function isExemptBySettings(senderJid, settings) {
  const num = String(senderJid || "").replace(/\D/g, "");
  if (!num) return false;

  const owner = (settings?.ownerNumber || "").replace(/\D/g, "") || ENV_OWNER;
  const white = [
    ...(Array.isArray(settings?.whitelistNumbers) ? settings.whitelistNumbers : []),
    ...ENV_WHITELIST,
  ]
    .map((x) => String(x || "").replace(/\D/g, ""))
    .filter(Boolean);

  if (owner && num.endsWith(owner)) return true;
  if (white.some((n) => num.endsWith(n))) return true;
  return false;
}

// استخراج النص من الرسائل
function extractText(message = {}) {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.audioMessage?.caption) return message.audioMessage.caption;
  if (message.templateButtonReplyMessage?.selectedDisplayText) return message.templateButtonReplyMessage.selectedDisplayText;
  if (message.buttonsResponseMessage?.selectedDisplayText) return message.buttonsResponseMessage.selectedDisplayText;
  if (message.listResponseMessage?.title) return message.listResponseMessage.title;
  if (message.viewOnceMessageV2?.message) return extractText(message.viewOnceMessageV2.message);
  if (message.ephemeralMessage?.message) return extractText(message.ephemeralMessage.message);
  return "";
}

const PROTECT_ALL = String(process.env.PROTECT_ALL_GROUPS || "").toLowerCase() === "true";

async function checkAndEnforce(sock, msg) {
  try {
    const key = msg?.key;
    const jid = key?.remoteJid;                    // group jid
    const rawFrom = key?.participant || key?.remoteJid;
    const fromMe = !!key?.fromMe;

    if (!jid || !/@g\.us$/i.test(jid)) return;     // ليس قروب
    if (fromMe) { dlog("skip fromMe"); return; }   // تجاهل رسائل البوت نفسه

    // ✅ تطبيع JID للمرسل
    const senderJid = normalizeUserJid(rawFrom || "");
    dlog("sender", { rawFrom, senderJid });

    // الإعدادات
    const settings = await ensureSettings();
    dlog("settings snapshot", {
      bannedWordsCount: Array.isArray(settings.bannedWords) ? settings.bannedWords.length : 0,
      autoKick: !!settings.autoKickEnabled,
      autoReply: !!settings.autoReplyEnabled,
    });

    // إن لم تكن الشمولية مفعّلة، تأكد أن القروب مفعّل من DB لهذا المستخدم
    if (!PROTECT_ALL) {
      const group = await Group.findOne({ jid, isProtected: true }).lean();
      if (!group) { dlog("group not protected", jid); return; }
    }

    // استثناء
    if (isExemptBySettings(senderJid, settings)) {
      dlog("sender exempt", senderJid);
      return;
    }

    // نص الرسالة
    const text = extractText(msg.message || {});
    if (!text) { dlog("no text found in message"); return; }

    // الكلمات المحظورة
    const words = Array.isArray(settings.bannedWords) ? settings.bannedWords : [];
    if (!words.length) { dlog("no bannedWords configured"); return; }

    // مطابقة
    if (!messageMatchesBanned(words, text)) {
      dlog("no banned match", { text });
      return;
    }

    // 1) حذف (قد يفشل لحظر واتساب حذف رسائل الآخرين)
    try {
      await sock.sendMessage(jid, { delete: key });
      dlog("message deleted");
    } catch (e) {
      console.warn("delete message failed:", e?.message || e);
    }

    // 2) سجل المخالفة
    const violation = await Violation.findOneAndUpdate(
      { groupJid: jid, userJid: senderJid },
      { $inc: { count: 1 }, $set: { lastAt: new Date() } },
      { upsert: true, new: true }
    );
    dlog("violation count", violation?.count);

    // 3) تحذير
    if (settings.autoReplyEnabled) {
      const mention = senderJid.split("@")[0];
      const warnText =
        violation.count === 1
          ? `⚠️ تحذير @${mention}: تم رصد كلمة محظورة. تكرارها سيؤدي إلى الطرد.`
          : `⛔ @${mention}: تكرار الكلمات المحظورة. قد يتم طردك من القروب.`;
      try {
        await sock.sendMessage(jid, { text: warnText, mentions: [senderJid] });
      } catch (e) {
        console.warn("warn message send failed:", e?.message || e);
      }
    }

    // 4) الطرد عند التكرار
    if (settings.autoKickEnabled && violation.count >= 2) {
      try {
        await sock.groupParticipantsUpdate(jid, [senderJid], "remove");
        await Group.updateMany({ jid }, { $inc: { kicks: 1 } }).catch(() => {});
        dlog("participant removed", senderJid);
      } catch (e) {
        console.warn("kick failed:", e?.message || e);
      }
    }
  } catch (err) {
    console.error("protection error:", err?.message || err);
  }
}

module.exports = { checkAndEnforce };
