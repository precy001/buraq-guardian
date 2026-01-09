import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Zap, LifeBuoy, Waves } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showBackLink?: boolean;
}

export function AuthLayout({ children, title, subtitle, showBackLink = true }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="wave-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M0 10 Q5 5 10 10 T20 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#wave-pattern)" />
          </svg>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-2">
                <Logo size="lg" />
              </div>
            </Link>
          </div>
          
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-4xl xl:text-5xl font-heading font-bold leading-tight mb-4 text-white">
                Advanced Pool Safety,
                <br />
                <span className="text-primary">Automated Protection</span>
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                The Buraq drowning detection system provides real-time monitoring and automatic rescue activation for complete peace of mind.
              </p>
            </motion.div>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield, label: 'Drowning Detection' },
                { icon: Zap, label: 'Instant Response' },
                { icon: LifeBuoy, label: 'Auto Rescue Hoist' },
                { icon: Waves, label: '24/7 Monitoring' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3 text-white/90"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
          
          <p className="text-sm text-white/60">
            © 2024 SCHIPHA. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="p-6 flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex items-center gap-3 lg:hidden">
            <Logo size="md" />
          </Link>
          <ThemeToggle />
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="mb-8">
              <h2 className="text-3xl font-heading font-bold text-foreground mb-2">{title}</h2>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>
            
            {children}
            
            {showBackLink && (
              <div className="mt-8 text-center">
                <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ← Back to home
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
