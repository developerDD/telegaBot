require("dotenv").config();
const { Telegraf } = require("telegraf");
const fs = require("fs");

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) {
    throw new Error("❌ TELEGRAM_TOKEN не знайдено! Додай його у змінні середовища.");
}

const bot = new Telegraf(BOT_TOKEN);

let settings = {
    totalPeople: null,
    people: [],
    drinkers: [],
    bathCost: null,
    foodExpenses: {},
    alcoholExpenses: {},
    waitingFor: null
};

if (fs.existsSync("data.json")) {
    settings = JSON.parse(fs.readFileSync("data.json"));
}

function saveData() {
    fs.writeFileSync("data.json", JSON.stringify(settings, null, 2));
}

bot.start((ctx) => {
    ctx.reply("Привіт! Давай розрахуємо витрати. Скільки людей було в бані?");
    settings = { totalPeople: null, people: [], drinkers: [], bathCost: null, foodExpenses: {}, alcoholExpenses: {}, waitingFor: "totalPeople" };
    saveData();
});

bot.on("text", (ctx) => {
    let text = ctx.message.text.trim().toLowerCase();

    if (settings.waitingFor === "totalPeople") {
        let number = parseInt(text);
        if (!isNaN(number) && number > 0) {
            settings.totalPeople = number;
            settings.people = [];
            settings.waitingFor = "peopleNames";
            ctx.reply(`Введіть імена всіх ${number} учасників (по одному за повідомленням).`);
            saveData();
        } else {
            ctx.reply("❌ Введіть правильну кількість людей.");
        }
        return;
    }

    if (settings.waitingFor === "peopleNames") {
        settings.people.push(text.charAt(0).toUpperCase() + text.slice(1));
        if (settings.people.length < settings.totalPeople) {
            ctx.reply("✅ Додано! Введіть наступне ім'я.");
        } else {
            settings.waitingFor = "drinkers";
            ctx.reply("Хто вживав алкоголь? Введіть імена (по одному за раз). Коли закінчите, напишіть 'Готово'.");
        }
        saveData();
        return;
    }

    if (settings.waitingFor === "drinkers") {
        if (text === "готово") {
            settings.waitingFor = "bathCost";
            ctx.reply("Скільки коштувала баня?");
        } else if (settings.people.includes(text.charAt(0).toUpperCase() + text.slice(1))) {
            settings.drinkers.push(text.charAt(0).toUpperCase() + text.slice(1));
            ctx.reply(`✅ ${text} додано до списку тих, хто вживав алкоголь.`);
        } else {
            ctx.reply("❌ Такого імені немає серед учасників.");
        }
        saveData();
        return;
    }

    if (settings.waitingFor === "bathCost") {
        let number = parseInt(text);
        if (!isNaN(number) && number >= 0) {
            settings.bathCost = number;
            settings.waitingFor = "foodExpenses";
            ctx.reply("Введіть витрати на їжу у форматі: Ім'я Сума");
            saveData();
        } else {
            ctx.reply("❌ Введіть правильну суму.");
        }
        return;
    }

    if (settings.waitingFor === "foodExpenses") {
        let parts = text.split(" ");
        if (parts.length !== 2) {
            ctx.reply("❌ Використовуйте: Ім'я Сума");
            return;
        }

        let name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        let amount = parseInt(parts[1]);

        if (isNaN(amount) || !settings.people.includes(name)) {
            ctx.reply("❌ Введіть коректне ім'я і суму.");
            return;
        }

        settings.foodExpenses[name] = (settings.foodExpenses[name] || 0) + amount;
        saveData();

        ctx.reply(`✅ ${name} витратив ${amount} грн на їжу. Більше витрат? (Так/Ні)`);
        settings.waitingFor = "foodConfirm";
        return;
    }

    if (settings.waitingFor === "foodConfirm") {
        if (text === "так") {
            ctx.reply("Введіть наступну витрату на їжу у форматі: Ім'я Сума");
            settings.waitingFor = "foodExpenses";
        } else if (text === "ні") {
            settings.waitingFor = "alcoholExpenses";
            ctx.reply("Тепер введіть витрати на алкоголь у форматі: Ім'я Сума");
        }
        return;
    }

    if (settings.waitingFor === "alcoholExpenses") {
        let parts = text.split(" ");
        if (parts.length !== 2) {
            ctx.reply("❌ Використовуйте: Ім'я Сума");
            return;
        }

        let name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        let amount = parseInt(parts[1]);

        if (isNaN(amount) || !settings.drinkers.includes(name)) {
            ctx.reply("❌ Введіть коректне ім'я і суму.");
            return;
        }

        settings.alcoholExpenses[name] = (settings.alcoholExpenses[name] || 0) + amount;
        saveData();

        ctx.reply(`✅ ${name} витратив ${amount} грн на алкоголь. Більше витрат? (Так/Ні)`);
        settings.waitingFor = "alcoholConfirm";
        return;
    }

    if (settings.waitingFor === "alcoholConfirm") {
        if (text === "так") {
            ctx.reply("Введіть наступну витрату на алкоголь у форматі: Ім'я Сума");
            settings.waitingFor = "alcoholExpenses";
        } else if (text === "ні") {
            ctx.reply("✅ Всі витрати записано! Обробляю дані...");
            ctx.reply(calculatePayments());
        }
        return;
    }
});

function calculatePayments() {
    let totalFood = Object.values(settings.foodExpenses).reduce((a, b) => a + b, 0);
    let totalAlcohol = Object.values(settings.alcoholExpenses).reduce((a, b) => a + b, 0);
    let perPersonFood = totalFood / settings.totalPeople;
    let perPersonBath = settings.bathCost / settings.totalPeople;
    let perDrinkerAlcohol = settings.drinkers.length > 0 ? totalAlcohol / settings.drinkers.length : 0;

    let result = `📊 *Розрахунок витрат:*\n`;
    result += `💰 Загальна сума: ${(totalFood + totalAlcohol + settings.bathCost).toFixed(2)} грн\n`;
    result += `🥗 Кожен платить за їжу: ${perPersonFood.toFixed(2)} грн\n`;
    result += `🛁 Кожен платить за баню: ${perPersonBath.toFixed(2)} грн\n`;
    result += `🍷 Кожен, хто пив, платить за алкоголь: ${perDrinkerAlcohol.toFixed(2)} грн\n\n`;

    settings.people.forEach((name) => {
        let spent = (settings.foodExpenses[name] || 0) + (settings.alcoholExpenses[name] || 0);
        let shouldPay = perPersonFood + perPersonBath + (settings.drinkers.includes(name) ? perDrinkerAlcohol : 0);
        let balance = spent - shouldPay;
        result += balance >= 0 ? `✅ ${name} переплатив: ${balance.toFixed(2)} грн (йому повертають)\n` : `❌ ${name} винен: ${(-balance).toFixed(2)} грн\n`;
    });

    return result;
}

bot.launch().then(() => console.log("✅ Бот працює!"));
