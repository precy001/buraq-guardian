import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { User, Moon, Sun, Bell, Shield, LogOut, Smartphone, Mail, MapPin, Phone } from 'lucide-react';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

export function SettingsSheet({ open, onOpenChange, onLogout }: SettingsSheetProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isSubscribed, isSupported, subscribeToPush } = usePushNotifications(user?.productId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-heading">Settings</SheetTitle>
          <SheetDescription>Manage your account and preferences</SheetDescription>
        </SheetHeader>

        {/* Profile Section */}
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </h3>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-muted-foreground font-mono">{user?.productId || 'N/A'}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{user?.email || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{user?.phone || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{user?.address || 'Not set'}</span>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Appearance */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              Appearance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode" className="text-sm font-medium text-foreground cursor-pointer">
                  Dark Mode
                </Label>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Notifications */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </h3>
            <div className="space-y-4">
              {isSupported ? (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Push Notifications</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receive drowning alerts even when the app is closed
                    </p>
                  </div>
                  <Switch
                    checked={isSubscribed}
                    onCheckedChange={() => {
                      if (!isSubscribed) subscribeToPush();
                    }}
                    disabled={isSubscribed}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Push notifications are not supported on this browser.
                </p>
              )}
            </div>
          </section>

          <Separator />

          {/* Device */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Device
            </h3>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product ID</span>
                <span className="font-mono text-foreground">{user?.productId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Push Status</span>
                <span className={isSubscribed ? 'text-success' : 'text-amber-500'}>
                  {isSubscribed ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Account Actions */}
          <section className="pb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Account
            </h3>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onLogout();
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
