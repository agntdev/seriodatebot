import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getSettings, saveSettings } from "../data.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
composer.callbackQuery("settings:open", async (ctx) => { await ctx.answerCallbackQuery(); const s = await getSettings(ctx); await ctx.editMessageText(`Настройки\nЯзык: русский\nУведомления: ${s.notifications ? "включены" : "выключены"}`, { reply_markup: inlineKeyboard([[inlineButton("Русский", "settings:language:ru")], [inlineButton(s.notifications ? "🔕 Выключить уведомления" : "🔔 Включить уведомления", "settings:notifications:toggle")], [inlineButton("⬅️ В меню", "menu:main")]]) }); });
composer.callbackQuery("settings:language:ru", async (ctx) => { await ctx.answerCallbackQuery(); const s = await getSettings(ctx); await saveSettings(ctx, { ...s, language: "ru" }); await ctx.reply("Язык сохранён: русский.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ В настройки", "settings:open")]]) }); });
composer.callbackQuery("settings:notifications:toggle", async (ctx) => { await ctx.answerCallbackQuery(); const s = await getSettings(ctx); await saveSettings(ctx, { ...s, notifications: !s.notifications }); await ctx.reply(`Уведомления ${!s.notifications ? "включены" : "выключены"}.`, { reply_markup: inlineKeyboard([[inlineButton("⬅️ В настройки", "settings:open")]]) }); });
export default composer;
