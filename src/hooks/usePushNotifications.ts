import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://schiiphaalayn.com.ng/api';

// VAPID public key — set this in your .env as VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(productId: string | undefined) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('default');
  const subscribedRef = useRef(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermissionState(Notification.permission);

      // Pre-register the service worker immediately so it's ready for push events
      navigator.serviceWorker.register('/sw-push.js', { scope: '/' }).catch((err) => {
        console.warn('SW pre-registration failed:', err);
      });

      // Check if already subscribed
      navigator.serviceWorker.ready.then(async (reg) => {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setIsSubscribed(true);
          subscribedRef.current = true;
        }
      }).catch(() => {});
    }
  }, []);

  // Register the push service worker and subscribe
  const subscribeToPush = useCallback(async () => {
    if (!isSupported || !productId) return false;

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== 'granted') {
        console.warn('Push notification permission denied');
        return false;
      }

      // Ensure service worker is registered and active
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      } catch {
        registration = await navigator.serviceWorker.ready;
      }

      // Wait for the service worker to become active
      if (!registration.active) {
        await new Promise<void>((resolve) => {
          const sw = registration.installing || registration.waiting;
          if (!sw) { resolve(); return; }
          sw.addEventListener('statechange', function handler() {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', handler);
              resolve();
            }
          });
        });
      }

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          console.warn('VAPID public key not configured. Push notifications require VAPID keys.');
          setIsSubscribed(true);
          subscribedRef.current = true;
          return true;
        }

        // Subscribe to push
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      }

      // Send subscription to server
      const resp = await fetch(`${API_BASE_URL}/push/subscribe.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          subscription: subscription.toJSON(),
        }),
      });

      if (!resp.ok) {
        console.error('Failed to save push subscription on server:', resp.status);
      }

      setIsSubscribed(true);
      subscribedRef.current = true;
      console.log('✅ Push notifications subscribed successfully');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }, [isSupported, productId]);

  // Auto-subscribe when product ID is available — retry up to 3 times
  useEffect(() => {
    if (!productId || !isSupported || subscribedRef.current) return;

    let attempts = 0;
    const trySubscribe = async () => {
      if (subscribedRef.current || attempts >= 3) return;
      attempts++;
      const success = await subscribeToPush();
      if (!success && attempts < 3) {
        setTimeout(trySubscribe, 2000 * attempts);
      }
    };

    trySubscribe();
  }, [productId, isSupported, subscribeToPush]);

  return { isSubscribed, isSupported, permissionState, subscribeToPush };
}
