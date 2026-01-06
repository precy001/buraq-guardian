import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { SubscriptionPanel } from '@/components/SubscriptionPanel';
import { PaymentPanel } from '@/components/PaymentPanel';
import { Waves, LogOut, User, Settings } from 'lucide-react';
import type { Subscription } from '@/context/AuthContext';

// Mock subscription data - replace with API call
const mockSubscription: Subscription = {
  id: 'sub-1',
  productId: 'BRQ-2024-0001',
  planName: 'Yearly Plan',
  status: 'active',
  startDate: '2024-01-15',
  expiryDate: '2024-04-15',
  daysRemaining: 200,
};

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen gradient-ocean">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-water flex items-center justify-center shadow-water">
                <Waves className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-heading font-bold text-foreground">The Buraq</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{user?.fullName}</span>
              </div>
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
            Welcome back, {user?.fullName?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">
            Manage your device subscription and payment details
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Subscription Status */}
          <SubscriptionPanel
            subscription={mockSubscription}
            productId={user?.productId || 'BRQ-XXXX-XXXX'}
          />

          {/* Payment Panel */}
          <PaymentPanel currentPlanId={mockSubscription.planName} />
        </div>
      </main>
    </div>
  );
}
