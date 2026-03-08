import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost/buraq-guardian/api' : '/api');

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

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermissionState(Notification.permission);
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

      // Register the push service worker
      const registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/',
      });

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          console.warn('VAPID public key not configured. Push notifications require VAPID keys.');
          // Still mark as subscribed for basic notifications
          setIsSubscribed(true);
          return true;
        }

        // Subscribe to push
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Send subscription to server
      await fetch(`${API_BASE_URL}/push/subscribe.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          subscription: subscription.toJSON(),
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }, [isSupported, productId]);

  // Auto-subscribe when product ID is available
  useEffect(() => {
    if (productId && isSupported && !isSubscribed) {
      subscribeToPush();
    }
  }, [productId, isSupported, isSubscribed, subscribeToPush]);

  return { isSubscribed, isSupported, permissionState, subscribeToPush };
}
