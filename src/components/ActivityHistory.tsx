import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_BASE_URL } from '@/lib/api';
import {
  AlertTriangle,
  ShieldCheck,
  Clock,
  ChevronDown,
  Siren,
  CreditCard,
  History,
  BatteryLow,
  WifiOff,
} from 'lucide-react';

interface Alert {
  id: number;
  product_id: string;
  alert_type: string;
  message: string;
  status: string;
  timestamp: string;
  acknowledged_at: string | null;
}

interface SubscriptionRecord {
  id: number;
  product_id: string;
  plan_name: string;
  status: string;
  start_date: string;
  end_date: string;
  payment_reference: string | null;
  created_at: string;
}

interface ActivityHistoryProps {
  productId: string;
}

const alertTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  drowning: {
    icon: <Siren className="w-4 h-4" />,
    label: 'Drowning Alert',
    color: 'text-destructive',
  },
  device_offline: {
    icon: <WifiOff className="w-4 h-4" />,
    label: 'Device Offline',
    color: 'text-warning',
  },
  low_battery: {
    icon: <BatteryLow className="w-4 h-4" />,
    label: 'Low Battery',
    color: 'text-warning',
  },
};

const subStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  expired: 'destructive',
  suspended: 'secondary',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function ActivityHistory({ productId }: ActivityHistoryProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [subsTotal, setSubsTotal] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [alertsOffset, setAlertsOffset] = useState(0);
  const [subsOffset, setSubsOffset] = useState(0);
  const PAGE_SIZE = 10;

  const fetchAlerts = useCallback(async (offset: number, append = false) => {
    setLoadingAlerts(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/alerts/history.php?product_id=${encodeURIComponent(productId)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) => (append ? [...prev, ...data.data.alerts] : data.data.alerts));
        setAlertsTotal(data.data.total);
      }
    } catch (e) {
      console.error('Failed to fetch alert history:', e);
    } finally {
      setLoadingAlerts(false);
    }
  }, [productId]);

  const fetchSubscriptions = useCallback(async (offset: number, append = false) => {
    setLoadingSubs(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/subscriptions/history.php?product_id=${encodeURIComponent(productId)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const data = await res.json();
      if (data.success) {
        setSubscriptions((prev) => (append ? [...prev, ...data.data.subscriptions] : data.data.subscriptions));
        setSubsTotal(data.data.total);
      }
    } catch (e) {
      console.error('Failed to fetch subscription history:', e);
    } finally {
      setLoadingSubs(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchAlerts(0);
    fetchSubscriptions(0);
  }, [fetchAlerts, fetchSubscriptions]);

  const loadMoreAlerts = () => {
    const next = alertsOffset + PAGE_SIZE;
    setAlertsOffset(next);
    fetchAlerts(next, true);
  };

  const loadMoreSubs = () => {
    const next = subsOffset + PAGE_SIZE;
    setSubsOffset(next);
    fetchSubscriptions(next, true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alerts" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="alerts" className="gap-1.5 text-xs sm:text-sm">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Alerts</span>
                {alertsTotal > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {alertsTotal}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1.5 text-xs sm:text-sm">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Subscriptions</span>
                {subsTotal > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {subsTotal}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="mt-4">
              {loadingAlerts && alerts.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldCheck className="w-10 h-10 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No alerts recorded</p>
                  <p className="text-xs text-muted-foreground mt-1">Your device has been safe</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const config = alertTypeConfig[alert.alert_type] || alertTypeConfig.drowning;
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className={`mt-0.5 ${config.color}`}>{config.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            <Badge
                              variant={alert.status === 'acknowledged' ? 'outline' : 'destructive'}
                              className="text-[10px] shrink-0"
                            >
                              {alert.status}
                            </Badge>
                          </div>
                          {alert.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {alert.message}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{timeAgo(alert.timestamp)}</span>
                            {alert.acknowledged_at && (
                              <span className="ml-2">
                                · Acknowledged {timeAgo(alert.acknowledged_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {alerts.length < alertsTotal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={loadMoreAlerts}
                      disabled={loadingAlerts}
                    >
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Load more
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" className="mt-4">
              {loadingSubs && subscriptions.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No subscription history</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Subscribe to a plan to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <div className="mt-0.5 text-primary">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {sub.plan_name}
                          </span>
                          <Badge
                            variant={subStatusVariant[sub.status] || 'outline'}
                            className="text-[10px] shrink-0"
                          >
                            {sub.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                          <span>
                            {formatDate(sub.start_date)} → {formatDate(sub.end_date)}
                          </span>
                          {sub.payment_reference && (
                            <span className="font-mono truncate max-w-[120px]">
                              Ref: {sub.payment_reference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {subscriptions.length < subsTotal && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={loadMoreSubs}
                      disabled={loadingSubs}
                    >
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Load more
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
