import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = 'http://localhost/buraq-guardian/api';
const POLL_INTERVAL = 5000; // Check every 5 seconds

interface DrowningAlert {
  id: string;
  productId: string;
  timestamp: string;
  status: 'active' | 'acknowledged';
  message: string;
}

// Generate alarm sound using Web Audio API (no external files needed)
function createAlarmSound(): { start: () => void; stop: () => void } {
  let audioContext: AudioContext | null = null;
  let oscillatorNodes: OscillatorNode[] = [];
  let gainNode: GainNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.8;

      // Create a pulsing two-tone alarm
      const playTone = (freq: number, duration: number) => {
        if (!audioContext || !gainNode) return;
        const osc = audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gainNode);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
        oscillatorNodes.push(osc);
      };

      // Alternate between two tones every 500ms for urgency
      let toggle = false;
      const pulse = () => {
        playTone(toggle ? 880 : 1320, 0.45);
        toggle = !toggle;
      };

      pulse();
      intervalId = setInterval(pulse, 500);
    } catch (e) {
      console.error('Failed to create alarm sound:', e);
    }
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    oscillatorNodes.forEach(osc => {
      try { osc.stop(); } catch {}
    });
    oscillatorNodes = [];
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  };

  return { start, stop };
}

export function useDrowningAlarm(productId: string | undefined) {
  const [alert, setAlert] = useState<DrowningAlert | null>(null);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const alarmRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkForAlerts = useCallback(async () => {
    if (!productId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/alerts/check.php?product_id=${encodeURIComponent(productId)}`
      );
      const data = await response.json();

      if (data.success && data.data?.alert) {
        const newAlert: DrowningAlert = {
          id: data.data.alert.id,
          productId: data.data.alert.product_id,
          timestamp: data.data.alert.timestamp,
          status: data.data.alert.status,
          message: data.data.alert.message || 'DROWNING DETECTED! Immediate action required!',
        };

        setAlert(newAlert);

        if (!isAlarmActive) {
          setIsAlarmActive(true);
          if (!alarmRef.current) {
            alarmRef.current = createAlarmSound();
          }
          alarmRef.current.start();

          // Also use Notification API if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 DROWNING ALERT!', {
              body: newAlert.message,
              icon: '/pwa-192x192.png',
              tag: 'drowning-alert',
              requireInteraction: true,
              vibrate: [1000, 500, 1000, 500, 1000],
            } as NotificationOptions);
          }

          // Vibrate device if supported
          if ('vibrate' in navigator) {
            navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
          }
        }
      }
    } catch (error) {
      // Silently fail - don't disrupt the user experience for network issues
      console.debug('Alert check failed:', error);
    }
  }, [productId, isAlarmActive]);

  const acknowledgeAlert = useCallback(async () => {
    // Stop the alarm
    if (alarmRef.current) {
      alarmRef.current.stop();
      alarmRef.current = null;
    }
    setIsAlarmActive(false);

    // Stop vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }

    // Notify backend
    if (alert?.id) {
      try {
        await fetch(`${API_BASE_URL}/alerts/acknowledge.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_id: alert.id, product_id: productId }),
        });
      } catch {}
    }

    setAlert(null);
  }, [alert, productId]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Start polling
  useEffect(() => {
    if (!productId) return;

    checkForAlerts();
    pollRef.current = setInterval(checkForAlerts, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (alarmRef.current) alarmRef.current.stop();
    };
  }, [productId, checkForAlerts]);

  return { alert, isAlarmActive, acknowledgeAlert };
}
