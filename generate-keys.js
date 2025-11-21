const webPush = require('web-push');

console.log('Генерация новых VAPID ключей...');
const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n=== СОХРАНИТЕ ЭТИ КЛЮЧИ В .env ФАЙЛ ===');
console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('========================================\n');

// Проверяем формат
console.log('Длина publicKey:', vapidKeys.publicKey.length);
console.log('Начинается с "B":', vapidKeys.publicKey.startsWith('B'));