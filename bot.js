require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("❌ TELEGRAM_TOKEN не знайдено! Додай його у змінні середовища.");
}

const bot = new Telegraf(BOT_TOKEN);

// 📌 Завантаження списку постійних учасників
const USERS_FILE = "users.json";
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];

// 📌 Головні налаштування
let settings = {
    selectedPeople: [],
    drinkers: [],
    bathCost: null,
    foodExpenses: {},
    alcoholExpenses: {},
    waitingFor: null,
    currentExpenseType: null,
    currentPerson: null
};

// 📌 Збереження даних
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveData() {
    fs.writeFileSync("data.json", JSON.stringify(settings, null, 2));
}

// 📌 Початкове меню
bot.start((ctx) => {
    ctx.reply("Привіт! Обери учасників, які були в бані:", getUsersMenu());
    settings.selectedPeople = [];
    settings.waitingFor = "selectPeople";
});

// 📌 Функція створення меню вибору користувачів
function getUsersMenu() {
    return Markup.inlineKeyboard([
        ...users.map((user) => Markup.button.callback(user, `select_${user}`)),
        [Markup.button.callback("➕ Додати нового", "add_new")],
        [Markup.button.callback("✅ Підтвердити вибір", "confirm_people")]
    ]);
}

// 📌 Вибір учасників (кнопки)
bot.action(/select_(.+)/, (ctx) => {
    let name = ctx.match[1];
    if (!settings.selectedPeople.includes(name)) {
        settings.selectedPeople.push(name);
        ctx.answerCbQuery(`✅ ${name} додано`);
    } else {
        ctx.answerCbQuery(`⚠️ ${name} вже в списку`);
    }
});

// 📌 Додати нового учасника
bot.action("add_new", (ctx) => {
    settings.waitingFor = "addNewUser";
    ctx.reply("Введіть ім'я нового учасника:");
});

// 📌 Обробка введення нового імені
bot.on("text", (ctx) => {
    let text = ctx.message.text.trim();

    if (settings.waitingFor === "addNewUser") {
        if (!users.includes(text)) {
            users.push(text);
            saveUsers();
            ctx.reply(`✅ ${text} додано до списку!`, getUsersMenu());
        } else {
            ctx.reply("⚠️ Це ім'я вже є.");
        }
        settings.waitingFor = null;
        return;
    }

    if (settings.waitingFor === "bathCost") {
        let number = parseInt(text);
        if (!isNaN(number) && number >= 0) {
            settings.bathCost = number;
            settings.waitingFor = "selectFoodSpender";
            ctx.reply("Хто витратив гроші на їжу?", getExpensePersonMenu("food"));
        } else {
            ctx.reply("❌ Введіть правильну суму.");
        }
        return;
    }

    if (settings.waitingFor === "enterExpenseAmount") {
        let amount = parseInt(text);
        if (!isNaN(amount) && amount > 0) {
            if (settings.currentExpenseType === "food") {
                settings.foodExpenses[settings.currentPerson] = (settings.foodExpenses[settings.currentPerson] || 0) + amount;
            } else if (settings.currentExpenseType === "alcohol") {
                settings.alcoholExpenses[settings.currentPerson] = (settings.alcoholExpenses[settings.currentPerson] || 0) + amount;
            }
            ctx.reply(`✅ ${settings.currentPerson} витратив ${amount} грн на ${settings.currentExpenseType === "food" ? "їжу" : "алкоголь"}.`);

            if (settings.currentExpenseType === "food") {
                ctx.reply("Хто ще витратив гроші на їжу?", getExpensePersonMenu("food"));
            } else if (settings.currentExpenseType === "alcohol") {
                ctx.reply("Хто ще витратив гроші на алкоголь?", getExpensePersonMenu("alcohol"));
            }

            settings.waitingFor = "selectExpensePerson";
        } else {
            ctx.reply("❌ Введіть правильну суму.");
        }
        return;
    }
});

// 📌 Меню вибору людини для витрат
function getExpensePersonMenu(type) {
    return Markup.inlineKeyboard([
        ...settings.selectedPeople.map((user) => Markup.button.callback(user, `expense_${type}_${user}`)),
        [Markup.button.callback("✅ Завершити введення", type === "food" ? "finishFoodExpenses" : "finishAlcoholExpenses")]
    ]);
}

// 📌 Завершення введення витрат
bot.action("finishFoodExpenses", (ctx) => {
    settings.waitingFor = "selectAlcoholSpender";
    ctx.reply("Тепер введіть витрати на алкоголь:", getExpensePersonMenu("alcohol"));
});

bot.action("finishAlcoholExpenses", (ctx) => {
    ctx.reply("✅ Всі витрати записано! Обробляю дані...");
    ctx.reply(calculatePayments(), getRestartMenu());
});

// 📌 Функція для кнопки "🔄 Почати новий розрахунок"
function getRestartMenu() {
    return Markup.inlineKeyboard([
        Markup.button.callback("🔄 Почати новий розрахунок", "new_calculation")
    ]);
}

// 📌 Фінальний розрахунок витрат
function calculatePayments() {
    let totalFood = Object.values(settings.foodExpenses).reduce((a, b) => a + b, 0);
    let perPersonFood = totalFood / settings.selectedPeople.length;
    let perPersonBath = settings.bathCost / settings.selectedPeople.length;
    let totalAlcohol = Object.values(settings.alcoholExpenses).reduce((a, b) => a + b, 0);
    let perDrinkerAlcohol = settings.drinkers.length > 0 ? totalAlcohol / settings.drinkers.length : 0;

    let result = `📊 *Розрахунок витрат:*\n`;
    result += `💰 Загальна сума: ${(totalFood + totalAlcohol + settings.bathCost).toFixed(2)} грн\n`;
    result += `🥗 Кожен платить за їжу: ${perPersonFood.toFixed(2)} грн\n`;
    result += `🛁 Кожен платить за баню: ${perPersonBath.toFixed(2)} грн\n`;
    result += `🍷 Кожен, хто пив, платить за алкоголь: ${perDrinkerAlcohol.toFixed(2)} грн\n\n`;

    settings.selectedPeople.forEach((name) => {
        let spent = (settings.foodExpenses[name] || 0) + (settings.alcoholExpenses[name] || 0);
        let shouldPay = perPersonFood + perPersonBath + (settings.drinkers.includes(name) ? perDrinkerAlcohol : 0);
        let balance = spent - shouldPay;
        result += balance >= 0 ? `✅ ${name} переплатив: ${balance.toFixed(2)} грн (йому повертають)\n` : `❌ ${name} винен: ${(-balance).toFixed(2)} грн\n`;
    });

    return result;
}

// 📌 Додаємо кнопку "Почати новий розрахунок"
bot.action("new_calculation", (ctx) => {
    ctx.reply("🔄 Починаємо новий підрахунок!", getUsersMenu());
});

bot.launch().then(() => console.log("✅ Бот працює!"));
