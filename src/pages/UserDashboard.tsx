import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { SubscriptionPanel } from '@/components/SubscriptionPanel';
import { PaymentPanel } from '@/components/PaymentPanel';
import { DrowningAlarmOverlay } from '@/components/DrowningAlarmOverlay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useDrowningAlarm } from '@/hooks/useDrowningAlarm';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { LogOut, User, Settings, AlertTriangle, Bell, Siren, Volume2, BellRing } from 'lucide-react';

export default function UserDashboard() {
  const { user, subscription, logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { alert, isAlarmActive, acknowledgeAlert, triggerTestAlarm, hasActiveSubscription } = useDrowningAlarm(user?.productId, subscription?.status);
  const { isSubscribed, isSupported, subscribeToPush } = usePushNotifications(user?.productId);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Drowning Alarm Overlay */}
      <DrowningAlarmOverlay
        isActive={isAlarmActive}
        message={alert?.message || ''}
        timestamp={alert?.timestamp || new Date().toISOString()}
        onAcknowledge={acknowledgeAlert}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <Logo size="md" />
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Alert status indicator */}
              {isSupported && (
                <button
                  onClick={subscribeToPush}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isSubscribed
                      ? 'bg-success/10 text-success'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer'
                  }`}
                  title={isSubscribed ? 'Push notifications active' : 'Click to enable push notifications'}
                >
                  {isSubscribed ? (
                    <Bell className="w-3.5 h-3.5" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{isSubscribed ? 'Notifications On' : 'Enable Notifications'}</span>
                </button>
              )}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{user?.fullName}</span>
              </div>
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Manage your device subscription and payment details
          </p>
        </motion.div>

        {/* No subscription warning */}
        {!subscription && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You don't have an active subscription. Choose a plan below to activate your device.
            </p>
          </motion.div>
        )}

        {/* Test Alarm Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
        
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <Volume2 className="w-4 h-4 flex-shrink-0" />
            <span><strong>Important:</strong> Set your device volume to maximum for the drowning alarm to work at full loudness. The alarm cannot override your system volume.</span>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <SubscriptionPanel
            subscription={subscription}
            productId={user?.productId || 'BRQ-XXXX-XXXX'}
          />
          <PaymentPanel currentPlanId={subscription?.planName} />
        </div>
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} onLogout={handleLogout} />
    </div>
  );
}
