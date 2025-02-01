# telegaBotconst readmeContent = `# Telegram Expense Bot

Цей бот допомагає розподіляти витрати між людьми.

## Як запустити

1. Клонуйте репозиторій.
2. Створіть файл .env та додайте TELEGRAM_TOKEN.
3. Встановіть залежності: \`npm install\`
4. Запустіть бота: \`npm start\``;
fs.writeFileSync("README.md", readmeContent);

console.log("✅ Всі файли створено!");
