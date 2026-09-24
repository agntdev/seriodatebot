import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getProfile } from "../data.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
composer.callbackQuery("discover:disabled", async (ctx) => { await ctx.answerCallbackQuery(); const profile = await getProfile(ctx); await ctx.editMessageText(profile ? "Знакомства скоро появятся. Ваша анкета уже сохранена — мы сообщим, когда всё будет готово." : "Сначала создайте анкету — так вы сможете перейти к знакомствам.", { reply_markup: inlineKeyboard([[inlineButton(profile ? "⬅️ В меню" : "👤 Создать анкету", profile ? "menu:main" : "profile:create:start")]]) }); });
export default composer;
