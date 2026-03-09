import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import { API_BASE_URL } from '@/lib/api';

type VerificationStatus = 'verifying' | 'success' | 'failed';

interface SubscriptionData {
  id: string;
  product_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  days_remaining: number;
  total_days: number;
}

export default function PaymentVerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSubscription } = useAuth();
  
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      // Get reference from URL (Paystack redirect) or sessionStorage
      const reference = searchParams.get('reference') || 
                       searchParams.get('trxref') || 
                       sessionStorage.getItem('payment_reference');

      if (!reference) {
        setStatus('failed');
        setMessage('No payment reference found. Please try again.');
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/subscriptions/verify.php?reference=${encodeURIComponent(reference)}`
        );

        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setMessage(data.data?.already_processed 
            ? 'Payment was already verified!' 
            : 'Payment verified successfully!');
          
          if (data.data?.subscription) {
            setSubscription(data.data.subscription);
          }

          // Refresh subscription in auth context
          if (refreshSubscription) {
            await refreshSubscription();
          }

          // Clear stored reference
          sessionStorage.removeItem('payment_reference');
          sessionStorage.removeItem('payment_plan');
        } else {
          setStatus('failed');
          setMessage(data.message || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('failed');
        setMessage('Network error. Please check your connection and try again.');
      }
    };

    verifyPayment();
  }, [searchParams, refreshSubscription]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card variant="elevated" className="text-center">
          <CardHeader className="pb-4">
            {status === 'verifying' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="mx-auto"
              >
                <Loader2 className="w-16 h-16 text-primary" />
              </motion.div>
            )}
            
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
              >
                <CheckCircle className="w-16 h-16 text-success mx-auto" />
              </motion.div>
            )}
            
            {status === 'failed' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
              >
                <XCircle className="w-16 h-16 text-destructive mx-auto" />
              </motion.div>
            )}

            <CardTitle className="mt-4">
              {status === 'verifying' && 'Verifying Payment'}
              {status === 'success' && 'Payment Successful!'}
              {status === 'failed' && 'Payment Failed'}
            </CardTitle>
            
            <CardDescription className="text-base">
              {message}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {status === 'success' && subscription && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-muted/50 rounded-lg p-4 space-y-3 text-left"
              >
                <h3 className="font-semibold text-center mb-3">Subscription Details</h3>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{subscription.plan_name}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-success capitalize">{subscription.status}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">{formatDate(subscription.start_date)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expiry Date</span>
                  <span className="font-medium">{formatDate(subscription.end_date)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Days Remaining</span>
                  <span className="font-medium">{subscription.days_remaining} days</span>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                variant="hero"
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="w-full"
              >
                <Home className="w-5 h-5" />
                Go to Dashboard
              </Button>
              
              {status === 'failed' && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
