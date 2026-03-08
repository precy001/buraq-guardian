import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { SubscriptionPanel } from '@/components/SubscriptionPanel';
import { PaymentPanel } from '@/components/PaymentPanel';
import { DrowningAlarmOverlay } from '@/components/DrowningAlarmOverlay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { useDrowningAlarm } from '@/hooks/useDrowningAlarm';
import { LogOut, User, Settings, AlertTriangle, Bell, Siren } from 'lucide-react';

export default function UserDashboard() {
  const { user, subscription, logout } = useAuth();
  const navigate = useNavigate();
  const { alert, isAlarmActive, acknowledgeAlert, triggerTestAlarm } = useDrowningAlarm(user?.productId);

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
            
            <div className="flex items-center gap-4">
              {/* Alert status indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Monitoring</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{user?.fullName}</span>
              </div>
              <ThemeToggle />
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
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
          <Button
            onClick={triggerTestAlarm}
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Siren className="w-4 h-4 mr-2" />
            Test Drowning Alarm
          </Button>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <SubscriptionPanel
            subscription={subscription}
            productId={user?.productId || 'BRQ-XXXX-XXXX'}
          />
          <PaymentPanel currentPlanId={subscription?.planName} />
        </div>
      </main>
    </div>
  );
}
