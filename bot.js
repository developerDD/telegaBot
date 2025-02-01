require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("❌ TELEGRAM_TOKEN не знайдено! Додай його у змінні середовища.");
}

const bot = new Telegraf(BOT_TOKEN);

// Файли для збереження даних
const USERS_FILE = "users.json";
const DATA_FILE = "data.json";

// Завантажуємо збережених учасників
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
let settings = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : {
    participants: [],
    drinkers: [],
    bathCost: 0,
    foodExpenses: {},
    alcoholExpenses: {},
    waitingFor: null
};

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2));
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Старт бота
bot.start((ctx) => {
    settings = {
        participants: [],
        drinkers: [],
        bathCost: 0,
        foodExpenses: {},
        alcoholExpenses: {},
        waitingFor: null
    };
    saveData();
    ctx.reply("Привіт! Обери учасників, які були в бані:", getUsersMenu());
    settings.waitingFor = "selectingParticipants";
});

function getUsersMenu() {
    const buttons = users.map((user) => Markup.button.callback(user, `user_${user}`));
    buttons.push(Markup.button.callback("➕ Додати нового", "add_new"));
    buttons.push(Markup.button.callback("✅ Підтвердити вибір", "confirm_users"));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

bot.action(/user_(.+)/, (ctx) => {
    const name = ctx.match[1];
    if (!settings.participants.includes(name)) {
        settings.participants.push(name);
    }
    ctx.answerCbQuery(`${name} додано!`);
    saveData();
});

bot.action("add_new", (ctx) => {
    ctx.reply("Введіть ім'я нового учасника:");
    settings.waitingFor = "newUser";
    saveData();
});

bot.action("confirm_users", (ctx) => {
    if (settings.participants.length === 0) {
        ctx.answerCbQuery("❌ Спочатку виберіть хоча б одного учасника!");
        return;
    }
    ctx.reply("Хто вживав алкоголь? Введіть імена (по одному за раз). Коли закінчите, напишіть 'Готово'.", getDrinkersMenu());
    settings.waitingFor = "selectingDrinkers";
    settings.drinkers = [];
    saveData();
});

function getDrinkersMenu() {
    const buttons = settings.participants.map((user) => Markup.button.callback(user, `drinker_${user}`));
    buttons.push(Markup.button.callback("✅ Завершити", "confirm_drinkers"));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

bot.action(/drinker_(.+)/, (ctx) => {
    const name = ctx.match[1];
    if (!settings.drinkers.includes(name)) {
        settings.drinkers.push(name);
    }
    ctx.answerCbQuery(`${name} додано до списку!`);
    saveData();
});

bot.action("confirm_drinkers", (ctx) => {
    ctx.reply("Скільки коштувала баня?");
    settings.waitingFor = "bathCost";
    saveData();
});

bot.on("text", (ctx) => {
    const text = ctx.message.text.trim();

    if (settings.waitingFor === "newUser") {
        if (!users.includes(text)) {
            users.push(text);
            saveUsers();
        }
        ctx.reply("✅ Додано!", getUsersMenu());
        settings.waitingFor = "selectingParticipants";
        saveData();
        return;
    }

    if (settings.waitingFor === "bathCost") {
        const amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            settings.bathCost = amount;
            settings.waitingFor = "foodExpenses";
            ctx.reply("Виберіть хто оплачував їжу:", getExpenseMenu("food"));
            saveData();
        } else {
            ctx.reply("❌ Введіть коректну суму.");
        }
        return;
    }
});

function getExpenseMenu(type) {
    const buttons = settings.participants.map((user) => Markup.button.callback(user, `${type}_${user}`));
    buttons.push(Markup.button.callback("✅ Завершити", `confirm_${type}`));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

bot.action(/food_(.+)/, (ctx) => {
    const name = ctx.match[1];
    ctx.reply(`Введіть суму витрат для ${name}:`);
    settings.waitingFor = `foodAmount_${name}`;
});

bot.on("text", (ctx) => {
    const text = ctx.message.text.trim();

    if (settings.waitingFor && settings.waitingFor.startsWith("foodAmount_")) {
        const name = settings.waitingFor.split("_")[1];
        const amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            if (!settings.foodExpenses[name]) {
                settings.foodExpenses[name] = 0;
            }
            settings.foodExpenses[name] += amount;
            ctx.reply(`✅ ${name} витратив ${amount} грн на їжу.`);
            saveData();
        } else {
            ctx.reply("❌ Введіть правильну суму.");
        }
        settings.waitingFor = "foodExpenses";
        return;
    }
});

bot.action("confirm_food", (ctx) => {
    ctx.reply("Виберіть хто оплачував алкоголь:", getExpenseMenu("alcohol"));
    settings.waitingFor = "alcoholExpenses";
    saveData();
});

bot.action(/alcohol_(.+)/, (ctx) => {
    const name = ctx.match[1];
    ctx.reply(`Введіть суму витрат для ${name}:`);
    settings.waitingFor = `alcoholAmount_${name}`;
});

bot.on("text", (ctx) => {
    const text = ctx.message.text.trim();

    if (settings.waitingFor && settings.waitingFor.startsWith("alcoholAmount_")) {
        const name = settings.waitingFor.split("_")[1];
        const amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            if (!settings.alcoholExpenses[name]) {
                settings.alcoholExpenses[name] = 0;
            }
            settings.alcoholExpenses[name] += amount;
            ctx.reply(`✅ ${name} витратив ${amount} грн на алкоголь.`);
            saveData();
        } else {
            ctx.reply("❌ Введіть правильну суму.");
        }
        settings.waitingFor = "alcoholExpenses";
        return;
    }
});

bot.action("confirm_alcohol", (ctx) => {
    ctx.reply("✅ Всі витрати записано! Обробляю дані...");
    ctx.reply("📊 Ось підсумок ваших витрат:");
    settings.waitingFor = null;
    saveData();
});

bot.launch().then(() => console.log("✅ Бот працює!"));
