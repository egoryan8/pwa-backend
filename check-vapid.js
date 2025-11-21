const webPush = require('web-push');

function validateVapidKeys(publicKey, privateKey) {
    console.log('=== ПРОВЕРКА VAPID КЛЮЧЕЙ ===');

    if (!publicKey || !privateKey) {
        console.log('❌ Ключи не определены в .env файле');
        return false;
    }

    console.log('Public Key:', publicKey);
    console.log('Private Key:', privateKey.substring(0, 20) + '...');
    console.log('Длина Public Key:', publicKey.length);
    console.log('Длина Private Key:', privateKey.length);

    // Проверяем формат
    const isValidFormat = publicKey.startsWith('B') && publicKey.length === 87;
    console.log('Формат Public Key:', isValidFormat ? '✅ OK' : '❌ INVALID');

    if (!isValidFormat) {
        console.log('⚠️  Public Key должен начинаться с "B" и иметь длину 87 символов');
    }

    return isValidFormat;
}

// Генерация новых ключей
console.log('\n=== ГЕНЕРАЦИЯ НОВЫХ VAPID КЛЮЧЕЙ ===');
const newVapidKeys = webPush.generateVAPIDKeys();

console.log('\n📋 ДЛЯ .env ФАЙЛА:');
console.log('VAPID_PUBLIC_KEY=' + newVapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + newVapidKeys.privateKey);

console.log('\n✅ ПРОВЕРКА НОВЫХ КЛЮЧЕЙ:');
validateVapidKeys(newVapidKeys.publicKey, newVapidKeys.privateKey);

// Тестируем отправку
console.log('\n=== ТЕСТИРОВАНИЕ КЛЮЧЕЙ ===');
webPush.setVapidDetails(
    'mailto:test@example.com',
    newVapidKeys.publicKey,
    newVapidKeys.privateKey
);

console.log('✅ VAPID ключи настроены корректно');