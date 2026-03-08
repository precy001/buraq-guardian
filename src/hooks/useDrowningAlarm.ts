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

// Generate alarm sound using Web Audio API with max volume to bypass DND
function createAlarmSound(): { start: () => void; stop: () => void } {
  let audioContext: AudioContext | null = null;
  let oscillatorNodes: OscillatorNode[] = [];
  let gainNode: GainNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let audioElement: HTMLAudioElement | null = null;

  const start = async () => {
    try {
      // Strategy 1: Web Audio API with max gain
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (required by browser autoplay policies)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 1.0;

      const playTone = (freq: number, duration: number) => {
        if (!audioContext || !gainNode || audioContext.state !== 'running') return;
        const osc = audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gainNode);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
        oscillatorNodes.push(osc);
      };

      let toggle = false;
      const pulse = () => {
        playTone(toggle ? 880 : 1320, 0.45);
        toggle = !toggle;
      };

      pulse();
      intervalId = setInterval(pulse, 500);

      // Strategy 2: HTML Audio element as backup (helps bypass DND on some devices)
      // Create a data URI of a simple beep to avoid needing external files
      try {
        const sampleRate = 8000;
        const duration = 1;
        const numSamples = sampleRate * duration;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, numSamples * 2, true);
        
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const freq = Math.floor(t * 2) % 2 === 0 ? 880 : 1320;
          const sample = Math.sin(2 * Math.PI * freq * t) * 32767;
          view.setInt16(44 + i * 2, sample, true);
        }
        
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        audioElement = new Audio(url);
        audioElement.loop = true;
        audioElement.volume = 1.0;
        audioElement.play().catch(() => {});
      } catch {}
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
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      audioElement = null;
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

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 DROWNING ALERT!', {
              body: newAlert.message,
              icon: '/pwa-192x192.png',
              tag: 'drowning-alert',
              renotify: true,
              silent: false,
              requireInteraction: true,
              vibrate: [1000, 500, 1000, 500, 1000],
            } as NotificationOptions);
          }

          if ('vibrate' in navigator) {
            navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
          }
        }
      }
    } catch (error) {
      console.debug('Alert check failed:', error);
    }
  }, [productId, isAlarmActive]);

  const acknowledgeAlert = useCallback(async () => {
    if (alarmRef.current) {
      alarmRef.current.stop();
      alarmRef.current = null;
    }
    setIsAlarmActive(false);

    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }

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

  const triggerTestAlarm = useCallback(() => {
    const testAlert: DrowningAlert = {
      id: 'test-' + Date.now(),
      productId: productId || 'TEST',
      timestamp: new Date().toISOString(),
      status: 'active',
      message: '⚠️ TEST ALARM — This is a simulated drowning alert!',
    };

    setAlert(testAlert);
    setIsAlarmActive(true);

    if (!alarmRef.current) {
      alarmRef.current = createAlarmSound();
    }
    alarmRef.current.start();

    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
    }
  }, [productId]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!productId) return;

    checkForAlerts();
    pollRef.current = setInterval(checkForAlerts, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (alarmRef.current) alarmRef.current.stop();
    };
  }, [productId, checkForAlerts]);

  return { alert, isAlarmActive, acknowledgeAlert, triggerTestAlarm };
}
