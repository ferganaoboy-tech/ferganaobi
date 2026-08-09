import { precacheAndRoute } from 'workbox-precaching';

// Vite PWA plugin injectManifest bu joyga array kiritadi
precacheAndRoute(self.__WB_MANIFEST || []);

// Yangilanish uchun kutilayotgan versiyani darhol faollashtirish
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification ushlab olish
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || "Yangi Xabarnoma", options)
    );
  }
});

// Xabarnoma bosilganda
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.url)
    );
  }
});
