import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusIndicator } from '@/components/StatusIndicator';
import { Badge } from '@/components/ui/badge';
import { Shield, Calendar, Clock, Cpu, AlertCircle } from 'lucide-react';
import type { Subscription } from '@/context/AuthContext';

interface SubscriptionPanelProps {
  subscription: Subscription | null;
  productId: string;
}

export function SubscriptionPanel({ subscription, productId }: SubscriptionPanelProps) {
  const isActive = subscription?.status === 'active';
  const isSuspended = subscription?.status === 'suspended';
  const isExpiringSoon = subscription ? subscription.daysRemaining <= 7 && subscription.daysRemaining > 0 : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card variant="elevated" className={cn(
        'relative overflow-hidden',
        isActive ? 'border-l-4 border-l-success' : isSuspended ? 'border-l-4 border-l-warning' : 'border-l-4 border-l-destructive'
      )}>
        {isActive && (
          <div className="absolute top-0 right-0 w-32 h-32 gradient-water opacity-10 rounded-bl-full" />
        )}
        
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Subscription Status
              </CardTitle>
              <CardDescription>
                Device protection and monitoring status
              </CardDescription>
            </div>
            <StatusIndicator status={subscription?.status || 'expired'} />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Device Info */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
            <div className="w-12 h-12 rounded-xl gradient-water flex items-center justify-center">
              <Cpu className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Product ID</p>
              <p className="font-mono font-semibold text-lg">{productId}</p>
            </div>
          </div>

          {subscription ? (
            <>
              {/* Subscription Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                  <p className="font-semibold">{subscription.planName}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Expires</p>
                  </div>
                  <p className="font-semibold">{new Date(subscription.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Days Remaining */}
              <div className="p-4 rounded-xl bg-accent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-accent-foreground" />
                    <span className="text-accent-foreground font-medium">Days Remaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-3xl font-bold font-heading',
                      isExpiringSoon ? 'text-warning' : 'text-accent-foreground'
                    )}>
                      {subscription.daysRemaining}
                    </span>
                    {isExpiringSoon && (
                      <Badge variant="warning" className="text-xs">
                        Expiring Soon
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-background/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      'h-full rounded-full transition-all',
                      isExpiringSoon ? 'bg-warning' : 'bg-success'
                    )}
                    style={{ width: `${Math.min((subscription.daysRemaining / subscription.totalDays) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {!isActive && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive font-medium mb-2">
                    {isSuspended
                      ? '⚠️ Your subscription is currently suspended by an administrator. Device protection is temporarily disabled.'
                      : '⚠️ Your device protection is currently inactive. Please renew your subscription to restore full functionality.'}
                  </p>
                  {isSuspended && (
                    <p className="text-sm text-muted-foreground">
                      Contact support: <a href="tel:+2349125402776" className="text-primary hover:underline">+234 912 540 2776</a>, <a href="tel:+2347048514845" className="text-primary hover:underline">+234 704 851 4845</a> or <a href="mailto:schiiphahealth@gmail.com" className="text-primary hover:underline">schiiphahealth@gmail.com</a>
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 rounded-xl bg-muted/30 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium mb-1">No Active Subscription</p>
              <p className="text-sm text-muted-foreground">
                Select a plan to activate your device protection
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
