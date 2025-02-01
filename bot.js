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

// Відображення списку учасників
function getUsersMenu() {
    if (users.length === 0) {
        return Markup.inlineKeyboard([
            [Markup.button.callback("➕ Додати нового", "add_new")]
        ]);
    }

    const buttons = users.map((user) => Markup.button.callback(user, `user_${user}`));
    buttons.push(Markup.button.callback("➕ Додати нового", "add_new"));
    buttons.push(Markup.button.callback("✅ Підтвердити вибір", "confirm_users"));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

// Додавання учасника в баню
bot.action(/user_(.+)/, (ctx) => {
    const name = ctx.match[1];
    if (!settings.participants.includes(name)) {
        settings.participants.push(name);
    }
    ctx.answerCbQuery(`${name} додано!`);
    saveData();
});

// Додавання нового учасника
bot.action("add_new", (ctx) => {
    ctx.reply("Введіть ім'я нового учасника:");
    settings.waitingFor = "newUser";
    saveData();
});

bot.on("text", (ctx) => {
    const text = ctx.message.text.trim();

    if (settings.waitingFor === "newUser") {
        if (!users.includes(text)) {
            users.push(text);
            saveUsers();
        }
        ctx.reply(`✅ ${text} додано!`, getUsersMenu());
        settings.waitingFor = "selectingParticipants";
        saveData();
        return;
    }
});

// Підтвердження учасників бані
bot.action("confirm_users", (ctx) => {
    if (settings.participants.length === 0) {
        ctx.answerCbQuery("❌ Спочатку виберіть хоча б одного учасника!");
        return;
    }
    ctx.reply("Хто вживав алкоголь? Виберіть зі списку або введіть ім'я вручну:", getDrinkersMenu());
    settings.waitingFor = "selectingDrinkers";
    settings.drinkers = [];
    saveData();
});

// Меню вибору тих, хто пив алкоголь
function getDrinkersMenu() {
    const buttons = settings.participants.map((user) => Markup.button.callback(user, `drinker_${user}`));
    buttons.push(Markup.button.callback("✅ Завершити", "confirm_drinkers"));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

// Додавання учасника у список тих, хто вживав алкоголь
bot.action(/drinker_(.+)/, (ctx) => {
    const name = ctx.match[1];
    if (!settings.drinkers.includes(name)) {
        settings.drinkers.push(name);
    }
    ctx.answerCbQuery(`${name} додано до списку!`);
    saveData();
});

// Завершення вибору тих, хто пив алкоголь
bot.action("confirm_drinkers", (ctx) => {
    ctx.reply("Скільки коштувала баня?");
    settings.waitingFor = "bathCost";
    saveData();
});

// Фіксація вартості бані та перехід до витрат на їжу
bot.on("text", (ctx) => {
    const text = ctx.message.text.trim();

    if (settings.waitingFor === "bathCost") {
        const amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            settings.bathCost = amount;
            settings.waitingFor = "foodExpenses";
            saveData();
            ctx.reply("✅ Записано! Тепер виберіть хто оплачував їжу:", getExpenseMenu("food"));
        } else {
            ctx.reply("❌ Введіть коректну суму.");
        }
        return;
    }
});

// Вибір тих, хто оплачував їжу або алкоголь
function getExpenseMenu(type) {
    const buttons = settings.participants.map((user) => Markup.button.callback(user, `${type}_${user}`));
    buttons.push(Markup.button.callback("✅ Завершити", `confirm_${type}`));
    return Markup.inlineKeyboard(buttons, { columns: 2 });
}

// Завершення введення витрат на їжу
bot.action("confirm_food", (ctx) => {
    ctx.reply("✅ Записано! Тепер виберіть хто оплачував алкоголь:", getExpenseMenu("alcohol"));
    settings.waitingFor = "alcoholExpenses";
    saveData();
});

// Завершення введення витрат на алкоголь
bot.action("confirm_alcohol", (ctx) => {
    ctx.reply("✅ Всі витрати записано! Обробляю дані...");
    ctx.reply(generateSummary());
    settings.waitingFor = null;
    saveData();
});

// Формування підсумкового звіту
function generateSummary() {
    let totalFood = Object.values(settings.foodExpenses).reduce((a, b) => a + b, 0);
    let totalAlcohol = Object.values(settings.alcoholExpenses).reduce((a, b) => a + b, 0);
    let totalBath = settings.bathCost;
    let totalAmount = totalFood + totalAlcohol + totalBath;

    let perPersonBath = totalBath / settings.participants.length;
    let perPersonFood = totalFood / settings.participants.length;
    let perPersonAlcohol = settings.drinkers.length > 0 ? totalAlcohol / settings.drinkers.length : 0;

    let results = `📊 *Розрахунок витрат:*\n💰 *Загальна сума:* ${totalAmount} грн\n`;
    results += `🥗 *Кожен платить за їжу:* ${perPersonFood.toFixed(2)} грн\n`;
    results += `🛁 *Кожен платить за баню:* ${perPersonBath.toFixed(2)} грн\n`;
    if (settings.drinkers.length > 0) {
        results += `🍷 *Кожен, хто пив, платить за алкоголь:* ${perPersonAlcohol.toFixed(2)} грн\n`;
    }

    return results;
}

bot.launch().then(() => console.log("✅ Бот працює!"));
