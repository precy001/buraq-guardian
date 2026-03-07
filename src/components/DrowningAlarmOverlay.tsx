import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, X } from 'lucide-react';

interface DrowningAlarmOverlayProps {
  isActive: boolean;
  message: string;
  timestamp: string;
  onAcknowledge: () => void;
}

export function DrowningAlarmOverlay({ isActive, message, timestamp, onAcknowledge }: DrowningAlarmOverlayProps) {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Pulsing red background */}
          <div className="absolute inset-0 bg-destructive/90 animate-pulse" />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative z-10 max-w-md w-full bg-card rounded-2xl p-8 text-center shadow-2xl"
          >
            {/* Alarm icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive flex items-center justify-center mb-6 animate-bounce">
              <AlertTriangle className="w-10 h-10 text-destructive-foreground" />
            </div>

            <h1 className="text-3xl font-heading font-bold text-destructive mb-2">
              🚨 DROWNING ALERT!
            </h1>

            <p className="text-lg text-foreground font-medium mb-2">
              {message}
            </p>

            <p className="text-sm text-muted-foreground mb-6">
              Detected at {new Date(timestamp).toLocaleTimeString()}
            </p>

            {/* Emergency contacts */}
            <div className="flex flex-col gap-3 mb-6">
              <a
                href="tel:+2349125402776"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg"
              >
                <Phone className="w-5 h-5" />
                Call Emergency: +234 912 540 2776
              </a>
              <a
                href="tel:+2347048514845"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium"
              >
                <Phone className="w-5 h-5" />
                Alternate: +234 704 851 4845
              </a>
            </div>

            <Button
              onClick={onAcknowledge}
              variant="outline"
              size="lg"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="w-5 h-5 mr-2" />
              Acknowledge Alert & Stop Alarm
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
