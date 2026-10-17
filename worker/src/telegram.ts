/**
 * Telegram Bot API Integration
 * Handles incoming webhooks, commands, price list previews, inline keyboards, and callbacks.
 */

import { Env, TelegramUpdate, TelegramMessage, TelegramCallbackQuery, Plan } from './types';
import { isAuthorizedAdmin } from './auth';
import { parsePriceList } from './parser';
import { validatePriceList } from './validation';
import {
  getCurrentPrices,
  publishPrices,
  rollbackPrices,
  updateTitle,
  setPendingUpdate,
  getPendingUpdate,
  clearPendingUpdate
} from './storage';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Call Telegram Bot API
 */
async function callTelegram(
  botToken: string,
  method: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/**
 * Send a message via Telegram Bot
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  options?: {
    parse_mode?: string;
    reply_markup?: unknown;
  }
): Promise<void> {
  try {
    await callTelegram(botToken, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup
    });
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}

/**
 * Edit an existing message
 */
export async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: string;
    reply_markup?: unknown;
  }
): Promise<void> {
  try {
    await callTelegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup
    });
  } catch (err) {
    console.error('Failed to edit Telegram message:', err);
  }
}

/**
 * Answer a callback query (removes loading state on Telegram client)
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await callTelegram(botToken, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text || ''
    });
  } catch (err) {
    console.error('Failed to answer callback query:', err);
  }
}

/**
 * Format plan items into a clean preview text
 */
export function formatPlanPreview(title: string, plans: Plan[]): string {
  let output = `📋 <b>پیش‌نمایش لیست قیمت:</b>\n`;
  output += `🏷 <b>عنوان:</b> ${escapeHtml(title)}\n\n`;

  plans.forEach((p, idx) => {
    output += `${idx + 1}. <b>${escapeHtml(p.name)}</b> ➔ <code>${escapeHtml(p.displayPrice)}</code>\n`;
  });

  return output;
}

/**
 * Escape HTML special chars for safe Telegram HTML formatting
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Handle incoming Telegram Update
 */
export async function handleTelegramUpdate(
  update: TelegramUpdate,
  env: Env
): Promise<Response> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle Callback Queries (inline keyboard clicks)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env, botToken);
    return new Response('OK', { status: 200 });
  }

  // Handle Messages
  if (update.message && update.message.text) {
    await handleMessage(update.message, env, botToken);
    return new Response('OK', { status: 200 });
  }

  return new Response('Ignored', { status: 200 });
}

/**
 * Process incoming Message
 */
async function handleMessage(
  message: TelegramMessage,
  env: Env,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const rawText = message.text?.trim() || '';

  // Check admin authorization
  if (!isAuthorizedAdmin(userId, env)) {
    await sendTelegramMessage(
      botToken,
      chatId,
      '⛔️ <b>دسترسی غیرمجاز</b>\nشناسه کاربری شما در لیست مدیران سیستم تعریف نشده است.'
    );
    return;
  }

  // Command: /start
  if (rawText === '/start') {
    const welcome = `👋 <b>سلام، به ربات مدیریت تعرفه‌ها خوش آمدید.</b>\n\n` +
      `این ربات به شما امکان می‌دهد تعرفه‌های وبسایت را بدون نیاز به تغییر کد یا استقرار مجدد به‌روزرسانی کنید.\n\n` +
      `📌 <b>دستورات اصلی:</b>\n` +
      `• /prices — مشاهده لیست قیمت‌های فعال\n` +
      `• /settitle [عنوان] — تغییر عنوان صفحه اصلی\n` +
      `• /undo — بازگردانی لیست به نسخه قبلی\n` +
      `• /cancel — لغو به‌روزرسانی معلق\n` +
      `• /help — راهنمای کامل فرمت ارسال قیمت‌ها\n\n` +
      `برای به‌روزرسانی قیمت‌ها، کافیست لیست خود را به صورت متن عادی برای ربات ارسال نمایید.`;
    await sendTelegramMessage(botToken, chatId, welcome);
    return;
  }

  // Command: /help
  if (rawText === '/help') {
    const help = `📖 <b>راهنمای ارسال و فرمت لیست قیمت‌ها:</b>\n\n` +
      `کافیست پیام خود را مانند نمونه زیر ارسال کنید:\n\n` +
      `<code>پلن‌های ویژه\n` +
      `10GB → 99K\n` +
      `20GB → 169K\n` +
      `30GB → 229K\n` +
      `50GB → 349K\n` +
      `100GB → 649K</code>\n\n` +
      `⚡️ <b>نکات مهم:</b>\n` +
      `• خط اول به عنوان عنوان لیست در نظر گرفته می‌شود (اختیاری).\n` +
      `• کاراکتر K یا هزار به عنوان ضریب ۱,۰۰۰ محاسبه می‌شود.\n` +
      `• از انواع جداکننده‌ها مانند <code>→</code>، <code>-></code>، <code>:</code>، <code>-</code> یا <code>=</code> می‌توانید استفاده کنید.\n` +
      `• اعداد فارسی و انگلیسی هر دو پشتیبانی می‌شوند.\n` +
      `• پس از ارسال، پیش‌نمایشی جهت تأیید نهایی نمایش داده خواهد شد.`;
    await sendTelegramMessage(botToken, chatId, help);
    return;
  }

  // Command: /prices
  if (rawText === '/prices') {
    const current = await getCurrentPrices(env.PRICING_KV);
    if (!current || current.plans.length === 0) {
      await sendTelegramMessage(botToken, chatId, '⚠️ در حال حاضر هیچ لیست قیمتی ثبت نشده است.');
      return;
    }

    let msg = `📊 <b>لیست قیمت‌های فعال در وبسایت:</b>\n`;
    msg += `🏷 <b>عنوان:</b> ${escapeHtml(current.title)}\n`;
    msg += `🕒 <b>تاریخ به‌روزرسانی:</b> <code>${escapeHtml(current.updatedAt)}</code>\n\n`;
    current.plans.forEach((p, idx) => {
      msg += `${idx + 1}. <b>${escapeHtml(p.name)}</b>: <code>${escapeHtml(p.displayPrice)}</code>\n`;
    });

    await sendTelegramMessage(botToken, chatId, msg);
    return;
  }

  // Command: /settitle <title>
  if (rawText.startsWith('/settitle')) {
    const newTitle = rawText.replace('/settitle', '').trim();
    if (!newTitle) {
      await sendTelegramMessage(botToken, chatId, '⚠️ لطفاً عنوان مورد نظر را پس از دستور وارد کنید.\nمثال:\n<code>/settitle پلن‌های اشتراک ماهانه</code>');
      return;
    }

    const updated = await updateTitle(env.PRICING_KV, newTitle);
    if (!updated) {
      await sendTelegramMessage(botToken, chatId, '❌ ابتدا باید یک لیست قیمت منتشر شود تا بتوانید عنوان آن را تغییر دهید.');
      return;
    }

    await sendTelegramMessage(botToken, chatId, `✅ عنوان صفحه به <b>"${escapeHtml(newTitle)}"</b> تغییر یافت.`);
    return;
  }

  // Command: /cancel
  if (rawText === '/cancel') {
    if (userId) {
      await clearPendingUpdate(env.PRICING_KV, userId);
    }
    await sendTelegramMessage(botToken, chatId, '✅ درخواست به‌روزرسانی معلق لغو شد.');
    return;
  }

  // Command: /undo
  if (rawText === '/undo') {
    const restored = await rollbackPrices(env.PRICING_KV);
    if (!restored) {
      await sendTelegramMessage(botToken, chatId, '❌ نسخه قبلی جهت بازگردانی یافت نشد.');
      return;
    }

    let msg = `🔄 <b>بازگردانی موفق به نسخه قبلی انجام شد:</b>\n`;
    msg += `🏷 <b>عنوان:</b> ${escapeHtml(restored.title)}\n\n`;
    restored.plans.forEach((p, idx) => {
      msg += `${idx + 1}. <b>${escapeHtml(p.name)}</b>: <code>${escapeHtml(p.displayPrice)}</code>\n`;
    });
    await sendTelegramMessage(botToken, chatId, msg);
    return;
  }

  // Otherwise, treat rawText as a price list payload!
  const defaultTitle = env.DEFAULT_TITLE || 'Special Plans';
  const defaultCurrency = env.DEFAULT_CURRENCY || 'TOMAN';

  const parseResult = parsePriceList(rawText, defaultTitle, defaultCurrency);
  const validation = validatePriceList(rawText, parseResult, defaultCurrency);

  if (!validation.isValid) {
    let errorMsg = `⚠️ <b>خطا در پردازش لیست قیمت:</b>\n\n`;
    validation.errors.forEach(err => {
      errorMsg += `• ${escapeHtml(err)}\n`;
    });
    errorMsg += `\nلطفاً خطاها را اصلاح نموده و مجدداً ارسال نمایید. برای راهنما /help را ارسال کنید.`;
    await sendTelegramMessage(botToken, chatId, errorMsg);
    return;
  }

  // Save pending update for confirmation
  if (userId) {
    await setPendingUpdate(env.PRICING_KV, userId, parseResult.title || defaultTitle, parseResult.plans);
  }

  const preview = formatPlanPreview(parseResult.title || defaultTitle, parseResult.plans);
  const prompt = `${preview}\n❓ آیا این لیست و تغییرات را در وبسایت منتشر می‌کنید؟`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ تایید و انتشار در سایت', callback_data: 'confirm_publish' },
        { text: '❌ انصراف', callback_data: 'cancel_publish' }
      ]
    ]
  };

  await sendTelegramMessage(botToken, chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

/**
 * Process Callback Queries
 */
async function handleCallbackQuery(
  query: TelegramCallbackQuery,
  env: Env,
  botToken: string
): Promise<void> {
  const userId = query.from.id;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const data = query.data;

  // Check admin authorization
  if (!isAuthorizedAdmin(userId, env)) {
    await answerCallbackQuery(botToken, query.id, '⛔️ دسترسی غیرمجاز!');
    return;
  }

  if (data === 'cancel_publish') {
    await clearPendingUpdate(env.PRICING_KV, userId);
    await answerCallbackQuery(botToken, query.id, 'انتشار لغو شد.');
    if (chatId && messageId) {
      await editTelegramMessage(
        botToken,
        chatId,
        messageId,
        '❌ <b>عملیات به‌روزرسانی قیمت‌ها لغو گردید.</b>'
      );
    }
    return;
  }

  if (data === 'confirm_publish') {
    const pending = await getPendingUpdate(env.PRICING_KV, userId);
    if (!pending) {
      await answerCallbackQuery(botToken, query.id, '⚠️ این درخواست منقضی یا لغو شده است.');
      if (chatId && messageId) {
        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          '⚠️ <b>این درخواست منقضی شده است. لطفاً لیست را مجدداً ارسال نمایید.</b>'
        );
      }
      return;
    }

    const defaultCurrency = env.DEFAULT_CURRENCY || 'TOMAN';
    const published = await publishPrices(env.PRICING_KV, {
      title: pending.title,
      plans: pending.plans,
      currency: defaultCurrency
    });

    await clearPendingUpdate(env.PRICING_KV, userId);
    await answerCallbackQuery(botToken, query.id, '✅ با موفقیت منتشر شد!');

    let successMsg = `🚀 <b>تعرفه‌ها با موفقیت در وبسایت منتشر شدند!</b>\n\n`;
    successMsg += `🏷 <b>عنوان:</b> ${escapeHtml(published.title)}\n`;
    successMsg += `🔢 <b>تعداد پلن‌ها:</b> ${published.plans.length}\n`;
    successMsg += `🕒 <b>زمان انتشار:</b> <code>${escapeHtml(published.updatedAt)}</code>\n\n`;
    successMsg += `وبسایت به‌صورت خودکار اطلاعات جدید را دریافت خواهد کرد. جهت بازگردانی به نسخه قبل از /undo استفاده کنید.`;

    if (chatId && messageId) {
      await editTelegramMessage(botToken, chatId, messageId, successMsg);
    } else if (chatId) {
      await sendTelegramMessage(botToken, chatId, successMsg);
    }
  }
}
