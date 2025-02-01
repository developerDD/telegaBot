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
    drinkers: null,
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
    settings.waitingFor = "totalPeople";
    saveData();
});

bot.on("text", (ctx) => {
    let text = ctx.message.text.trim().toLowerCase();

    if (settings.waitingFor === "totalPeople") {
        let number = parseInt(text);
        if (!isNaN(number) && number > 0) {
            settings.totalPeople = number;
            settings.waitingFor = "drinkers";
            ctx.reply("Скільки людей вживало алкоголь?");
            saveData();
        } else {
            ctx.reply("❌ Введіть коректну кількість людей.");
        }
        return;
    }

    if (settings.waitingFor === "drinkers") {
        let number = parseInt(text);
        if (!isNaN(number) && number >= 0 && number <= settings.totalPeople) {
            settings.drinkers = number;
            settings.waitingFor = "bathCost";
            ctx.reply("Скільки коштувала баня?");
            saveData();
        } else {
            ctx.reply("❌ Введіть правильну кількість людей, які пили алкоголь.");
        }
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
            ctx.reply("❌ Неправильний формат. Використовуйте: Ім'я Сума");
            return;
        }

        let name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        let amount = parseInt(parts[1]);

        if (isNaN(amount)) {
            ctx.reply("❌ Введіть правильну суму.");
            return;
        }

        if (!settings.foodExpenses[name]) {
            settings.foodExpenses[name] = 0;
        }
        settings.foodExpenses[name] += amount;
        saveData();

        ctx.reply("✅ Додано: " + name + " витратив " + amount + " грн на їжу. Більше витрат? (Так/Ні)");
        settings.waitingFor = "foodConfirm";
    }
});

bot.launch().then(() => console.log("✅ Бот працює!"));
