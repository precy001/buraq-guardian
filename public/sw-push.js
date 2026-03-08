// Custom Service Worker for Push Notifications
// This runs in the background even when the browser tab is closed

self.addEventListener('push', function(event) {
  let data = {
    title: '🚨 DROWNING ALERT!',
    body: 'DROWNING DETECTED! Immediate action required!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: 'drowning-alert',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [1000, 500, 1000, 500, 1000, 500, 1000],
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'call', title: 'Call Emergency' },
    ],
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'call') {
    event.waitUntil(clients.openWindow('tel:+2349125402776'));
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/dashboard');
    })
  );
});
