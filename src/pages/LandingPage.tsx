import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Waves, Shield, Zap, LifeBuoy, ChevronRight, Play, Users, Award, Clock } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Drowning Detection',
    description: 'Advanced AI-powered sensors detect distress signals in real-time, monitoring every movement in your pool.',
  },
  {
    icon: Zap,
    title: 'Instant Response',
    description: 'Within seconds of detection, the system activates emergency protocols and notifies designated contacts.',
  },
  {
    icon: LifeBuoy,
    title: 'Auto Rescue Hoist',
    description: 'Automated rescue mechanism deploys immediately, providing critical assistance before help arrives.',
  },
  {
    icon: Clock,
    title: '24/7 Monitoring',
    description: 'Continuous protection around the clock, ensuring safety even when you\'re not watching.',
  },
];

const stats = [
  { value: '500+', label: 'Devices Deployed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<3s', label: 'Response Time' },
  { value: '24/7', label: 'Monitoring' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen gradient-ocean">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-water flex items-center justify-center shadow-water">
                <Waves className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-heading font-bold text-foreground">The Buraq</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="default" size="sm">
                  Register Device
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
                <Shield className="w-4 h-4" />
                Advanced Pool Safety Technology
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-6 leading-tight">
                Protect Your Loved Ones with 
              <br />
                <span className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground mb-6 leading-tight">Intelligent Pool Safety</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                The Buraq is an AI-powered drowning detection system that automatically activates an electronic rescue hoist, providing instant protection for your swimming pool.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register">
                  <Button variant="hero" size="xl">
                    Register Your Device
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="xl">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card variant="glass" className="text-center p-6">
                  <CardContent className="p-0">
                    <p className="text-3xl sm:text-4xl font-heading font-bold mb-1">
                      {stat.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-4">
              Complete Pool Protection
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive safety system combines cutting-edge technology with reliability you can trust.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card variant="elevated" className="h-full hover:shadow-water transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl gradient-water flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <Card variant="elevated" className="gradient-hero overflow-hidden">
            <CardContent className="p-8 sm:p-12 text-center text-primary-foreground">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-4">
                  Ready to Protect Your Pool?
                </h2>
                <p className="text-lg text-primary-foreground/80 mb-8">
                  Register your Buraq device today and activate your subscription to start protecting your loved ones.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link to="/register">
                    <Button variant="hero" size="lg" className="bg-primary-foreground text-secondary hover:bg-primary-foreground/90">
                      Get Started Now
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="lg" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">
                      Already Registered?
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg gradient-water flex items-center justify-center">
                <Waves className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-heading font-semibold text-foreground">The Buraq</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 The Buraq. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/admin/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
