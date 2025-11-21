const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webPush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Детальная CORS конфигурация
const corsOptions = {
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, из мобильных приложений)
        if (!origin) return callback(null, true);

        // Разрешаем локальные адреса и любые другие источники
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://localhost:3000',
            'https://127.0.0.1:3000'
        ];

        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
        } else {
            console.log('CORS blocked for origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Применяем CORS ко всем маршрутам
app.use(cors(corsOptions));

// Обработка preflight запросов
app.options('*', cors(corsOptions));

// Body parser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Логирование всех запросов для отладки
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent']
    });
    next();
});

// ВАЖНО: Используйте реальный email
const VAPID_EMAIL = 'fogel_92@bk.ru'; // ЗАМЕНИТЕ НА РЕАЛЬНЫЙ

// Получаем ключи из .env
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

console.log('=== VAPID CONFIGURATION ===');
console.log('Email:', VAPID_EMAIL);
console.log('Public Key exists:', !!vapidKeys.publicKey);
console.log('Private Key exists:', !!vapidKeys.privateKey);
console.log('Public Key length:', vapidKeys.publicKey?.length);
console.log('Public Key starts with B:', vapidKeys.publicKey?.startsWith('B'));

// Проверяем ключи
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.error('❌ VAPID keys are missing in .env file!');
    process.exit(1);
}

if (!vapidKeys.publicKey.startsWith('B') || vapidKeys.publicKey.length !== 87) {
    console.error('❌ Invalid VAPID public key format!');
    process.exit(1);
}

// Настраиваем web-push
try {
    webPush.setVapidDetails(
        `mailto:${VAPID_EMAIL}`,
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
    console.log('✅ VAPID details configured successfully');
} catch (error) {
    console.error('❌ Error configuring VAPID:', error);
    process.exit(1);
}

// Хранилище подписок
let subscriptions = [];

// ==================== МАРШРУТЫ ====================

// Health check с CORS headers
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        subscriptions: subscriptions.length,
        cors: 'enabled'
    });
});

// VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
    console.log('📨 Request for VAPID public key from origin:', req.headers.origin);
    res.json({
        publicKey: vapidKeys.publicKey,
        email: VAPID_EMAIL
    });
});

// Диагностика
app.get('/api/diagnostic', (req, res) => {
    res.json({
        vapid: {
            publicKey: vapidKeys.publicKey,
            publicKeyLength: vapidKeys.publicKey.length,
            email: VAPID_EMAIL,
            configured: true
        },
        server: {
            port: PORT,
            environment: process.env.NODE_ENV || 'development'
        },
        cors: {
            enabled: true,
            origin: req.headers.origin
        },
        subscriptions: {
            count: subscriptions.length
        }
    });
});

// Подписка
app.post('/api/subscribe', async (req, res) => {
    console.log('📨 Subscribe request from:', req.headers.origin);

    const { subscription } = req.body;

    if (!subscription) {
        return res.status(400).json({ error: 'No subscription provided' });
    }

    console.log('🔐 Subscription endpoint:', subscription.endpoint);

    // Сохраняем подписку
    subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
    subscriptions.push(subscription);

    console.log('✅ Subscription saved. Total:', subscriptions.length);

    // Тестируем отправку немедленно
    try {
        const payload = JSON.stringify({
            title: 'Добро пожаловать!',
            message: 'Push-уведомления успешно настроены! 🎉',
            icon: '/pwa-192x192.png'
        });

        await webPush.sendNotification(subscription, payload);
        console.log('✅ Test notification sent successfully');

        res.json({
            success: true,
            message: 'Подписка сохранена и тестовое уведомление отправлено!',
            totalSubscriptions: subscriptions.length
        });

    } catch (error) {
        console.error('❌ Test notification failed:', error);

        // Но все равно сохраняем подписку
        res.json({
            success: true,
            message: 'Подписка сохранена, но тестовое уведомление не отправлено',
            warning: error.message,
            totalSubscriptions: subscriptions.length
        });
    }
});

// Отписка
app.post('/api/unsubscribe', (req, res) => {
    const { subscription } = req.body;

    if (subscription && subscription.endpoint) {
        subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
        console.log('🗑️ Subscription removed:', subscription.endpoint);
    }

    res.json({
        success: true,
        message: 'Подписка удалена',
        totalSubscriptions: subscriptions.length
    });
});

// Отправка уведомления
app.post('/api/send-notification', async (req, res) => {
    const { title, message, icon } = req.body;

    if (subscriptions.length === 0) {
        return res.status(400).json({ error: 'Нет активных подписок' });
    }

    const payload = JSON.stringify({
        title: title || 'Тестовое уведомление',
        message: message || 'Это тестовое сообщение!',
        icon: icon || '/pwa-192x192.png',
        url: '/'
    });

    let successCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
        try {
            await webPush.sendNotification(subscription, payload);
            successCount++;
        } catch (error) {
            console.error('❌ Notification failed for:', subscription.endpoint, error);
            errorCount++;

            // Удаляем невалидные подписки
            if (error.statusCode === 410) {
                subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
            }
        }
    }

    res.json({
        success: true,
        message: `Уведомления отправлены: ${successCount} успешно, ${errorCount} с ошибками`,
        results: {
            success: successCount,
            errors: errorCount,
            total: subscriptions.length
        }
    });
});

// Проверка валидности подписки
app.post('/api/check-subscription', async (req, res) => {
    const { subscription } = req.body;

    if (!subscription) {
        return res.json({ valid: false, error: 'No subscription provided' });
    }

    // Проверяем, есть ли эта подписка в нашем хранилище
    const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);

    if (!exists) {
        return res.json({ valid: false, error: 'Subscription not found on server' });
    }

    // Пробуем отправить тестовое уведомление
    try {
        const testPayload = JSON.stringify({
            title: 'Проверка подписки',
            message: 'Ваша подписка активна! ✅',
            icon: '/pwa-192x192.png',
            timestamp: new Date().toISOString()
        });

        await webPush.sendNotification(subscription, testPayload);
        res.json({ valid: true, message: 'Subscription is valid' });

    } catch (error) {
        console.error('Subscription validation failed:', error);

        // Удаляем невалидную подписку
        subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);

        res.json({
            valid: false,
            error: error.message,
            statusCode: error.statusCode
        });
    }
});

// Детальная отладка подписки
app.post('/api/debug-subscription', (req, res) => {
    const { subscription } = req.body;

    res.json({
        existsOnServer: subscriptions.some(sub => sub.endpoint === subscription.endpoint),
        totalSubscriptions: subscriptions.length,
        subscriptionDetails: {
            endpoint: subscription.endpoint,
            keys: subscription.keys ? {
                auth: `...${subscription.keys.auth.slice(-10)}`,
                p256dh: `...${subscription.keys.p256dh.slice(-10)}`
            } : 'No keys'
        }
    });
});

// Обработка ошибок CORS
app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            error: 'CORS Error',
            message: 'Доступ с этого origin запрещен',
            allowedOrigins: ['localhost', '127.0.0.1']
        });
    }
    next(err);
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log('\n🚀 PWA Push Server started successfully!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📧 VAPID Email: ${VAPID_EMAIL}`);
    console.log(`🔑 VAPID Public Key: ${vapidKeys.publicKey.substring(0, 20)}...`);
    console.log(`📊 Total subscriptions: ${subscriptions.length}`);
    console.log(`🌐 CORS: Enabled for localhost and 127.0.0.1`);
    console.log('\n✅ Server is ready to accept requests\n');
});