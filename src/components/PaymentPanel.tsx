import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Zap, Crown, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: string;
  popular?: boolean;
  features: string[];
  savings?: string;
}

const plans: Plan[] = [
  {
    id: 'daily',
    name: 'Daily',
    price: 10000,
    duration: '1 day',
    features: ['24/7 Monitoring', 'Instant Alerts', 'Auto Rescue Activation', 'Email Support'],
  },
  {
    id: 'weekly',
    name: 'Weekly',
    price: 30000,
    duration: '7 days',
    savings: 'Save 57%',
    features: ['24/7 Monitoring', 'Instant Alerts', 'Auto Rescue Activation', 'SMS Alerts', 'Priority Support'],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: 50000,
    duration: '30 days',
    popular: true,
    savings: 'Save 83%',
    features: ['24/7 Monitoring', 'Instant Alerts', 'Auto Rescue Activation', 'SMS Alerts', 'Priority Support', 'Weekly Reports'],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 550000,
    duration: '365 days',
    savings: 'Save 85%',
    features: ['24/7 Monitoring', 'Instant Alerts', 'Auto Rescue Activation', 'SMS Alerts', 'Dedicated Support', 'Monthly Reports', 'Advanced Analytics', 'Free Maintenance Check'],
  },
];

interface PaymentPanelProps {
  currentPlanId?: string;
}

export function PaymentPanel({ currentPlanId }: PaymentPanelProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!selectedPlan) {
      toast.error('Please select a subscription plan');
      return;
    }

    setIsProcessing(true);
    
    // Simulate Paystack redirect
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Redirecting to Paystack...');
    // In production: window.location.href = paystackCheckoutUrl;
    
    setIsProcessing(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Subscription Plans
          </CardTitle>
          <CardDescription>
            Choose a plan to activate or renew your device protection
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    selectedPlan === plan.id
                      ? 'border-primary bg-primary/5 shadow-water'
                      : 'border-border hover:border-primary/50 bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        plan.popular ? 'gradient-water' : 'bg-muted'
                      }`}>
                        {plan.popular ? (
                          <Crown className="w-5 h-5 text-primary-foreground" />
                        ) : plan.id === 'yearly' ? (
                          <Star className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <Zap className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{plan.name}</h3>
                          {plan.popular && (
                            <Badge variant="default" className="text-xs">
                              Most Popular
                            </Badge>
                          )}
                          {plan.savings && (
                            <Badge variant="success" className="text-xs">
                              {plan.savings}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.duration}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-heading">{formatPrice(plan.price)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </button>
              </motion.div>
            ))}
          </div>

          <Button
            variant="hero"
            size="lg"
            className="w-full"
            onClick={handlePayment}
            disabled={!selectedPlan || isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                {selectedPlan ? 'Proceed to Payment' : 'Select a Plan'}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by Paystack. Your payment information is encrypted and secure.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
