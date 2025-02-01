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

bot.start((ctx) => {
    ctx.reply("Привіт! Обери учасників, які були в бані:", getUsersMenu());
    settings.participants = [];
    settings.waitingFor = "selectingParticipants";
    saveData();
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
    ctx.reply("Хто вживав алкоголь? Введіть імена (по одному за раз). Коли закінчите, напишіть 'Готово'.");
    settings.drinkers = [];
    settings.waitingFor = "selectingDrinkers";
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

    if (settings.waitingFor === "selectingDrinkers") {
        if (text.toLowerCase() === "готово") {
            ctx.reply("Скільки коштувала баня?");
            settings.waitingFor = "bathCost";
        } else if (settings.participants.includes(text)) {
            settings.drinkers.push(text);
            ctx.reply(`✅ ${text} додано до списку тих, хто вживав алкоголь.`);
        } else {
            ctx.reply("❌ Такого учасника немає в списку. Введіть ім'я ще раз.");
        }
        saveData();
        return;
    }

    if (settings.waitingFor === "bathCost") {
        const amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            settings.bathCost = amount;
            settings.waitingFor = "foodExpenses";
            ctx.reply("Введіть витрати на їжу у форматі: Ім'я Сума");
            saveData();
        } else {
            ctx.reply("❌ Введіть коректну суму.");
        }
        return;
    }

    if (settings.waitingFor === "foodExpenses" || settings.waitingFor === "alcoholExpenses") {
        let parts = text.split(" ");
        if (parts.length !== 2) {
            ctx.reply("❌ Неправильний формат. Використовуйте: Ім'я Сума");
            return;
        }

        let name = parts[0];
        let amount = parseInt(parts[1]);
        if (isNaN(amount)) {
            ctx.reply("❌ Введіть правильну суму.");
            return;
        }

        let expenseCategory = settings.waitingFor === "foodExpenses" ? settings.foodExpenses : settings.alcoholExpenses;
        if (!expenseCategory[name]) {
            expenseCategory[name] = 0;
        }
        expenseCategory[name] += amount;
        saveData();

        ctx.reply(`✅ ${name} витратив ${amount} грн. Більше витрат? (Так/Ні)`);
        settings.waitingFor = settings.waitingFor === "foodExpenses" ? "foodConfirm" : "alcoholConfirm";
    }
});

bot.action("newCalculation", (ctx) => {
    settings = {
        participants: [],
        drinkers: [],
        bathCost: 0,
        foodExpenses: {},
        alcoholExpenses: {},
        waitingFor: null
    };
    saveData();
    ctx.reply("🔄 Починаємо новий підрахунок!", getUsersMenu());
});

bot.launch().then(() => console.log("✅ Бот працює!"));
