import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://schiiphaalayn.com.ng/api';
const POLL_INTERVAL = 5000; // Check every 5 seconds

interface DrowningAlert {
  id: string;
  productId: string;
  timestamp: string;
  status: 'active' | 'acknowledged';
  message: string;
}

// LIFE-CRITICAL ALARM: Uses every technique to maximize loudness
// - Multiple layered oscillators at piercing frequencies
// - Dynamic compressor to maximize perceived loudness
// - Wave shaping (soft clipping) to fill the waveform
// - Multiple simultaneous HTML Audio elements
// - Continuous vibration pattern
function createAlarmSound(): { start: () => Promise<void>; stop: () => void } {
  let audioContext: AudioContext | null = null;
  let oscillatorNodes: OscillatorNode[] = [];
  let gainNode: GainNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let audioElements: HTMLAudioElement[] = [];
  let audioObjectUrls: string[] = [];

  const start = async () => {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Dynamic compressor — pushes quiet parts up, maximizes perceived volume
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 0;
      compressor.ratio.value = 20;
      compressor.attack.value = 0;
      compressor.release.value = 0.01;
      compressor.connect(audioContext.destination);

      // Waveshaper for soft clipping — fills the waveform to max amplitude
      const waveshaper = audioContext.createWaveShaper();
      const curve = new Float32Array(65536);
      for (let i = 0; i < 65536; i++) {
        const x = (i * 2) / 65536 - 1;
        curve[i] = (Math.PI / 2) * Math.atan(x * 5); // Aggressive soft clip
      }
      waveshaper.curve = curve;
      waveshaper.oversample = '4x';
      waveshaper.connect(compressor);

      // Master gain at max
      gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      gainNode.connect(waveshaper);

      // Play multiple layered tones at piercing frequencies for maximum urgency
      const playAlarmChord = (baseFreq: number, duration: number) => {
        if (!audioContext || !gainNode || audioContext.state !== 'running') return;

        // Layer 1: Square wave (loudest, most piercing)
        const osc1 = audioContext.createOscillator();
        osc1.type = 'square';
        osc1.frequency.value = baseFreq;
        const g1 = audioContext.createGain();
        g1.gain.value = 0.5;
        osc1.connect(g1);
        g1.connect(gainNode);
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + duration);
        oscillatorNodes.push(osc1);

        // Layer 2: Sawtooth an octave up (adds brightness/urgency)
        const osc2 = audioContext.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = baseFreq * 2;
        const g2 = audioContext.createGain();
        g2.gain.value = 0.3;
        osc2.connect(g2);
        g2.connect(gainNode);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + duration);
        oscillatorNodes.push(osc2);

        // Layer 3: High piercing sine (3kHz range — most sensitive human hearing)
        const osc3 = audioContext.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = 3000;
        const g3 = audioContext.createGain();
        g3.gain.value = 0.2;
        osc3.connect(g3);
        g3.connect(gainNode);
        osc3.start(audioContext.currentTime);
        osc3.stop(audioContext.currentTime + duration);
        oscillatorNodes.push(osc3);
      };

      let toggle = false;
      const pulse = () => {
        playAlarmChord(toggle ? 880 : 1320, 0.4);
        toggle = !toggle;
      };

      pulse();
      intervalId = setInterval(pulse, 450);

      // Strategy 2: Multiple HTML Audio elements playing simultaneously
      try {
        const sampleRate = 44100;
        const duration = 2;
        const numSamples = sampleRate * duration;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

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
          const cyclePos = t % 1;
          const freq = cyclePos < 0.5 ? 880 : 1320;
          // Combine square + sine at 3kHz for max piercing effect
          const square = Math.sign(Math.sin(2 * Math.PI * freq * t));
          const highPiercing = Math.sin(2 * Math.PI * 3000 * t) * 0.4;
          const combined = (square * 0.7 + highPiercing) * 32767;
          const clamped = Math.max(-32767, Math.min(32767, combined));
          view.setInt16(44 + i * 2, clamped, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });

        // Create multiple audio elements for redundancy
        for (let a = 0; a < 2; a++) {
          const url = URL.createObjectURL(blob);
          audioObjectUrls.push(url);
          const audio = new Audio(url);
          audio.loop = true;
          audio.volume = 1.0;
          audioElements.push(audio);
          await audio.play().catch(() => {});
        }
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

    oscillatorNodes.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    oscillatorNodes = [];

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    audioElements.forEach((el) => {
      el.pause();
      el.src = '';
    });
    audioElements = [];

    audioObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    audioObjectUrls = [];
  };

  return { start, stop };
}

export function useDrowningAlarm(productId: string | undefined, subscriptionStatus?: string) {
  const [alert, setAlert] = useState<DrowningAlert | null>(null);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const alarmRef = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAlarmActiveRef = useRef(false);

  useEffect(() => {
    isAlarmActiveRef.current = isAlarmActive;
  }, [isAlarmActive]);

  const hasActiveSubscription = subscriptionStatus === 'active';

  const checkForAlerts = useCallback(async () => {
    if (!productId || !hasActiveSubscription) return;

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

        if (!isAlarmActiveRef.current) {
          setIsAlarmActive(true);
          if (!alarmRef.current) {
            alarmRef.current = createAlarmSound();
          }
          void alarmRef.current.start();

          // Send notification that can bring the app to foreground
          if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('🚨 DROWNING ALERT!', {
              body: newAlert.message,
              icon: '/pwa-192x192.png',
              tag: 'drowning-alert',
              renotify: true,
              silent: false,
              requireInteraction: true,
              vibrate: [1000, 500, 1000, 500, 1000],
            } as NotificationOptions);

            // When user clicks notification, bring app to foreground
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          }

          if ('vibrate' in navigator) {
            navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
          }
        }
      }
    } catch (error) {
      console.debug('Alert check failed:', error);
    }
  }, [productId, hasActiveSubscription]);

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
    if (!productId) {
      console.warn('Cannot trigger alarm: product ID is missing');
      return;
    }

    const testMessage = '⚠️ TEST ALARM — This is a simulated drowning alert!';

    // Trigger local alarm immediately (don't block on network)
    const testAlert: DrowningAlert = {
      id: 'test-' + Date.now(),
      productId,
      timestamp: new Date().toISOString(),
      status: 'active',
      message: testMessage,
    };

    setAlert(testAlert);
    setIsAlarmActive(true);

    if (!alarmRef.current) {
      alarmRef.current = createAlarmSound();
    }
    void alarmRef.current.start();

    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]);
    }

    // Trigger backend alert + push in parallel
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/alerts/trigger.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productId,
            message: testMessage,
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          console.error('Backend alert trigger failed:', result?.message || `HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to trigger backend alert:', error);
      }
    })();
  }, [productId]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!productId || !hasActiveSubscription) return;

    checkForAlerts();
    pollRef.current = setInterval(checkForAlerts, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (alarmRef.current) {
        alarmRef.current.stop();
        alarmRef.current = null;
      }
    };
  }, [productId, hasActiveSubscription, checkForAlerts]);

  return { alert, isAlarmActive, acknowledgeAlert, triggerTestAlarm, hasActiveSubscription };
}
