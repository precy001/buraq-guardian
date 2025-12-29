import React from 'react';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'active' | 'expired' | 'suspended' | 'pending';
  showDot?: boolean;
  className?: string;
}

const statusConfig = {
  active: {
    label: 'Active',
    dotClass: 'bg-success',
    textClass: 'text-success',
    bgClass: 'bg-success/10',
  },
  expired: {
    label: 'Expired',
    dotClass: 'bg-destructive',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  suspended: {
    label: 'Suspended',
    dotClass: 'bg-warning',
    textClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  pending: {
    label: 'Pending',
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  },
};

export function StatusIndicator({ status, showDot = true, className }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
        config.bgClass,
        config.textClass,
        className
      )}
    >
      {showDot && (
        <span className={cn('w-2 h-2 rounded-full animate-pulse', config.dotClass)} />
      )}
      {config.label}
    </div>
  );
}
