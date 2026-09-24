import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getProfile } from "../data.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "👤 Создать анкету", data: "profile:create:start", order: 10 });
registerMainMenuItem({ label: "👤 Моя анкета", data: "profile:view", order: 10 });
registerMainMenuItem({ label: "🔎 Знакомства", data: "discover:disabled", order: 20 });
registerMainMenuItem({ label: "⚙️ Настройки", data: "settings:open", order: 30 });
registerMainMenuItem({ label: "🆘 Помощь", data: "help:open", order: 40 });

const composer = new Composer<Ctx>();
const WELCOME = "👋 Добро пожаловать! Здесь можно спокойно создать анкету для серьёзных отношений.";

async function menu(ctx: Ctx): Promise<void> {
  const profile = await getProfile(ctx);
  const rows = profile
    ? [[inlineButton("👤 Моя анкета", "profile:view")], [inlineButton("🔎 Знакомства", "discover:disabled")], [inlineButton("⚙️ Настройки", "settings:open")], [inlineButton("🆘 Помощь", "help:open")]]
    : [[inlineButton("👤 Создать анкету", "profile:create:start")], [inlineButton("🔎 Знакомства", "discover:disabled")], [inlineButton("⚙️ Настройки", "settings:open")], [inlineButton("🆘 Помощь", "help:open")]];
  await ctx.reply(WELCOME, { reply_markup: inlineKeyboard(rows) });
}

composer.command("start", menu);
composer.callbackQuery("menu:main", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText(WELCOME, { reply_markup: inlineKeyboard((await getProfile(ctx)) ? [[inlineButton("👤 Моя анкета", "profile:view")], [inlineButton("🔎 Знакомства", "discover:disabled")], [inlineButton("⚙️ Настройки", "settings:open")], [inlineButton("🆘 Помощь", "help:open")]] : [[inlineButton("👤 Создать анкету", "profile:create:start")], [inlineButton("🔎 Знакомства", "discover:disabled")], [inlineButton("⚙️ Настройки", "settings:open")], [inlineButton("🆘 Помощь", "help:open")]]) }); });

export default composer;
