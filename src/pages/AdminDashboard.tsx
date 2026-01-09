import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/StatusIndicator';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import {
  LogOut, Search, Filter, Users, Cpu, CreditCard, AlertTriangle,
  Eye, Play, Pause, Clock, MoreVertical, ChevronDown, RefreshCw, Plus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const API_BASE_URL = 'http://localhost/buraq-guardian/api';

interface OverviewStats {
  total_products: number;
  registered_products: number;
  unregistered_products: number;
  active_subscriptions: number;
  expired_subscriptions: number;
  suspended_subscriptions: number;
  total_users: number;
  monthly_revenue: number;
}

interface Product {
  id: string;
  product_id: string;
  is_registered: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
  subscription_status?: 'active' | 'expired' | 'suspended' | null;
  plan_name?: string;
  expiry_date?: string;
  days_remaining?: number;
}

type FilterType = 'all' | 'active' | 'expired' | 'suspended' | 'expiring-soon' | 'registered' | 'unregistered';

export default function AdminDashboard() {
  const { user, adminSession, adminLogout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const fetchOverview = useCallback(async () => {
    if (!adminSession?.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/overview.php`, {
        headers: {
          'Authorization': `Bearer ${adminSession.token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    }
  }, [adminSession?.token]);

  const fetchProducts = useCallback(async () => {
    if (!adminSession?.token) return;
    
    try {
      const params = new URLSearchParams({
        limit: '50',
        search: searchQuery,
      });
      
      if (filter === 'registered' || filter === 'unregistered') {
        params.append('filter', filter);
      } else if (filter !== 'all' && filter !== 'expiring-soon') {
        params.append('subscription_status', filter);
      }

      const response = await fetch(`${API_BASE_URL}/admin/products/index.php?${params}`, {
        headers: {
          'Authorization': `Bearer ${adminSession.token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProducts(data.data.products);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, [adminSession?.token, searchQuery, filter]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchOverview(), fetchProducts()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchOverview, fetchProducts]);

  const handleLogout = async () => {
    await adminLogout();
    navigate('/');
  };

  const handleGenerateProductId = async () => {
    if (!adminSession?.token) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/products/generate.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSession.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`New Product ID generated: ${data.data.product_id}`);
        fetchProducts();
        fetchOverview();
      } else {
        toast.error(data.message || 'Failed to generate product ID');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubscriptionAction = async (action: 'activate' | 'suspend' | 'expire' | 'extend', productId: string) => {
    if (!adminSession?.token) return;
    
    try {
      const body: Record<string, string | number> = { product_id: productId, action };
      if (action === 'extend') {
        body.extend_days = 30;
      }
      
      const response = await fetch(`${API_BASE_URL}/admin/subscriptions/update.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSession.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Subscription ${action}d successfully`);
        fetchProducts();
        fetchOverview();
      } else {
        toast.error(data.message || `Failed to ${action} subscription`);
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const filteredProducts = products.filter(product => {
    if (filter === 'expiring-soon') {
      return product.subscription_status === 'active' && (product.days_remaining || 0) <= 7;
    }
    return true;
  });

  const statsCards = [
    { label: 'Total Devices', value: stats?.total_products || 0, icon: Cpu, color: 'text-primary' },
    { label: 'Active Subscriptions', value: stats?.active_subscriptions || 0, icon: CreditCard, color: 'text-success' },
    { label: 'Expired', value: stats?.expired_subscriptions || 0, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Total Users', value: stats?.total_users || 0, icon: Users, color: 'text-secondary' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1">
                <Logo size="sm" />
              </div>
              <div>
                <Badge variant="outline" className="text-xs border-secondary-foreground/30">
                  Admin
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-secondary-foreground/80">
                {user?.email}
              </span>
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-secondary-foreground hover:bg-secondary-foreground/10">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage all registered devices and subscriptions
            </p>
          </div>
          <Button onClick={handleGenerateProductId} disabled={isGenerating}>
            <Plus className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Product ID'}
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card variant="elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-heading font-bold">
                        {isLoading ? '-' : stat.value}
                      </p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Products Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card variant="elevated">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Registered Devices</CardTitle>
                  <CardDescription>
                    View and manage all device registrations and subscriptions
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { fetchProducts(); fetchOverview(); }}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by Product ID, name, or email..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Filter className="w-4 h-4 mr-2" />
                      {filter === 'all' ? 'All Status' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    {(['all', 'registered', 'unregistered', 'active', 'expired', 'suspended', 'expiring-soon'] as FilterType[]).map((f) => (
                      <DropdownMenuItem key={f} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All Status' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Table */}
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No devices found matching your criteria</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-medium">{product.product_id}</TableCell>
                          <TableCell>
                            {product.is_registered && product.user_name ? (
                              <div>
                                <p className="font-medium">{product.user_name}</p>
                                <p className="text-sm text-muted-foreground">{product.user_email}</p>
                              </div>
                            ) : (
                              <Badge variant="outline">Unregistered</Badge>
                            )}
                          </TableCell>
                          <TableCell>{product.plan_name || '-'}</TableCell>
                          <TableCell>
                            {product.subscription_status ? (
                              <StatusIndicator status={product.subscription_status} />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {product.expiry_date 
                              ? new Date(product.expiry_date).toLocaleDateString() 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${
                              (product.days_remaining || 0) <= 7 && product.subscription_status === 'active'
                                ? 'text-warning'
                                : product.subscription_status === 'expired'
                                ? 'text-destructive'
                                : ''
                            }`}>
                              {product.days_remaining ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => toast.info(`Viewing ${product.product_id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {product.subscription_status && product.subscription_status !== 'active' && (
                                  <DropdownMenuItem onClick={() => handleSubscriptionAction('activate', product.product_id)}>
                                    <Play className="w-4 h-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {product.subscription_status === 'active' && (
                                  <DropdownMenuItem onClick={() => handleSubscriptionAction('suspend', product.product_id)}>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Suspend
                                  </DropdownMenuItem>
                                )}
                                {product.subscription_status && (
                                  <DropdownMenuItem onClick={() => handleSubscriptionAction('extend', product.product_id)}>
                                    <Clock className="w-4 h-4 mr-2" />
                                    Extend 30 Days
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
