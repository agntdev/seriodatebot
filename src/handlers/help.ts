import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
const HELP = "Здесь можно создать анкету для серьёзных отношений. Откройте /start и выбирайте нужные действия кнопками. Если что-то пошло не так, отправьте нам сообщение — мы разберёмся.";
composer.command("help", async (ctx) => { await ctx.reply(HELP, { reply_markup: inlineKeyboard([[inlineButton("🆘 Сообщить о проблеме", "help:report")]]) }); });
composer.callbackQuery("menu:help", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.editMessageText(HELP, { reply_markup: inlineKeyboard([[inlineButton("🆘 Сообщить о проблеме", "help:report")], [inlineButton("⬅️ В меню", "menu:main")]]) }); });
export default composer;
