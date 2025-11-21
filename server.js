const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const webPush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Генерация VAPID ключей (выполнить один раз и сохранить в .env)
// const vapidKeys = webPush.generateVAPIDKeys();
// console.log(vapidKeys);

const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

webPush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Хранилище подписок (в реальном приложении используйте базу данных)
let subscriptions = [];

// Маршруты
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/subscribe', (req, res) => {
    const subscription = req.body.subscription;

    if (!subscriptions.find(sub => sub.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription);
        console.log('Новая подписка добавлена:', subscription.endpoint);
    }

    res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/api/unsubscribe', (req, res) => {
    const subscription = req.body.subscription;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
    console.log('Подписка удалена:', subscription.endpoint);
    res.json({ message: 'Подписка удалена' });
});

app.post('/api/send-notification', async (req, res) => {
    const { title, message, icon } = req.body;

    if (subscriptions.length === 0) {
        return res.status(400).json({ error: 'Нет активных подписок' });
    }

    const payload = JSON.stringify({
        title: title || 'Уведомление',
        message: message || 'Новое сообщение',
        icon: icon || '/pwa-192x192.png',
        url: '/'
    });

    const results = [];

    // Отправляем уведомления всем подписчикам
    for (const subscription of subscriptions) {
        try {
            await webPush.sendNotification(subscription, payload);
            results.push({ endpoint: subscription.endpoint, status: 'success' });
            console.log('Уведомление отправлено:', subscription.endpoint);
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);

            // Если подписка невалидна, удаляем её
            if (error.statusCode === 410) {
                subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
                console.log('Невалидная подписка удалена:', subscription.endpoint);
            }

            results.push({ endpoint: subscription.endpoint, status: 'error', error: error.message });
        }
    }

    res.json({
        message: `Уведомления отправлены ${results.filter(r => r.status === 'success').length} пользователям`,
        results
    });
});

app.get('/api/subscriptions', (req, res) => {
    res.json({
        total: subscriptions.length,
        subscriptions: subscriptions.map(sub => ({ endpoint: sub.endpoint }))
    });
});

app.post('/api/send-custom-notification', async (req, res) => {
    const { title, message, icon, url } = req.body;

    if (!title || !message) {
        return res.status(400).json({ error: 'Title и message обязательны' });
    }

    const payload = JSON.stringify({
        title,
        message,
        icon: icon || '/pwa-192x192.png',
        url: url || '/'
    });

    const results = [];

    for (const subscription of subscriptions) {
        try {
            await webPush.sendNotification(subscription, payload);
            results.push({ endpoint: subscription.endpoint, status: 'success' });
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
            if (error.statusCode === 410) {
                subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
            }
            results.push({ endpoint: subscription.endpoint, status: 'error', error: error.message });
        }
    }

    res.json({
        message: `Кастомное уведомление отправлено ${results.filter(r => r.status === 'success').length} пользователям`,
        results
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 VAPID Public Key: ${vapidKeys.publicKey}`);
});