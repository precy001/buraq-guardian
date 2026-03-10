import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Download, Smartphone, Shield, Bell, CheckCircle, Monitor, Share2, Chrome } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Store prompt globally so it survives re-renders and route changes
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen for the event as early as possible (module scope)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isChromium, setIsChromium] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Detect Chromium-based browsers (Chrome, Edge, Opera, Brave, etc.)
    setIsChromium(!!(window as any).chrome || /chrome|chromium|edg|opr|brave/i.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Also check if prompt became available while navigating
    if (globalDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt && !globalDeferredPrompt) return;
    const prompt = deferredPrompt || globalDeferredPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    globalDeferredPrompt = null;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const benefits = [
    { icon: Bell, title: 'Instant Drowning Alerts', desc: 'Receive loud alarm notifications even when the app is in background' },
    { icon: Shield, title: 'Works Offline', desc: 'Core features available without internet connection' },
    { icon: Smartphone, title: 'Native App Feel', desc: 'Runs like a native app on your home screen' },
  ];

  const showInstallButton = deferredPrompt || globalDeferredPrompt;

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <Logo size="md" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 sm:px-6 pt-32 pb-20">
        <div className="max-w-lg mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 mx-auto rounded-2xl gradient-water flex items-center justify-center mb-6">
              <Download className="w-10 h-10 text-primary-foreground" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-4">
              Install Al A'yn App
            </h1>
            <p className="text-muted-foreground mb-8">
              Install the app on your device for the best experience with real-time drowning alerts.
            </p>

            {isInstalled ? (
              <div className="flex items-center justify-center gap-2 text-success mb-8">
                <CheckCircle className="w-6 h-6" />
                <span className="font-semibold text-lg">App is installed!</span>
              </div>
            ) : showInstallButton ? (
              <Button variant="hero" size="xl" onClick={handleInstall} className="mb-8">
                <Download className="w-5 h-5 mr-2" />
                Install Now
              </Button>
            ) : (
              <Card variant="glass" className="mb-8">
                <CardContent className="p-6 text-left text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground mb-3">How to install:</p>
                  
                  {platform === 'ios' && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Share2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Step 1: Tap the Share button</p>
                          <p>Tap the share icon (square with arrow) at the bottom of Safari</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Download className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Step 2: Add to Home Screen</p>
                          <p>Scroll down and tap "Add to Home Screen"</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {platform === 'android' && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Tap the browser menu (⋮)</p>
                          <p>Then select "Install app" or "Add to Home screen"</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {platform === 'desktop' && (
                    <div className="space-y-3">
                      {isChromium && (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <Chrome className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">Quick Install (Chrome / Edge)</p>
                            <p>Look for the install icon <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⊕</span> in the <strong>right side of the address bar</strong>, then click it.</p>
                            <p className="mt-1">Or open the browser menu <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⋮</span> → "Install Buraq..."</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Monitor className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Not seeing the install icon?</p>
                          <p>Make sure you're visiting the <strong>published URL</strong> directly (not inside an iframe or editor). The install option appears only on HTTPS pages served directly.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>

          <div className="space-y-4">
            {benefits.map((b, i) => (
              <motion.div key={b.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
                <Card variant="glass">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <b.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground text-sm">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Link to="/login" className="block mt-8">
            <Button variant="outline" size="lg">Go to Login</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
