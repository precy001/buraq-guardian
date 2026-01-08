import React, { useState } from 'react';
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
import {
  Waves, LogOut, Search, Filter, Users, Cpu, CreditCard, AlertTriangle,
  Eye, Play, Pause, Clock, MoreVertical, ChevronDown, RefreshCw
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

// Mock data - replace with API
const mockProducts = [
  {
    id: '1',
    productId: 'BRQ-2024-0001',
    userName: 'John Doe',
    email: 'john@example.com',
    status: 'active' as const,
    planName: 'Quarterly',
    expiryDate: '2024-04-15',
    daysRemaining: 23,
  },
  {
    id: '2',
    productId: 'BRQ-2024-0002',
    userName: 'Jane Smith',
    email: 'jane@example.com',
    status: 'expired' as const,
    planName: 'Monthly',
    expiryDate: '2024-03-01',
    daysRemaining: 0,
  },
  {
    id: '3',
    productId: 'BRQ-2024-0003',
    userName: 'Mike Johnson',
    email: 'mike@example.com',
    status: 'active' as const,
    planName: 'Yearly',
    expiryDate: '2025-01-20',
    daysRemaining: 298,
  },
  {
    id: '4',
    productId: 'BRQ-2024-0004',
    userName: 'Sarah Williams',
    email: 'sarah@example.com',
    status: 'suspended' as const,
    planName: 'Quarterly',
    expiryDate: '2024-05-10',
    daysRemaining: 45,
  },
  {
    id: '5',
    productId: 'BRQ-2024-0005',
    userName: 'David Brown',
    email: 'david@example.com',
    status: 'active' as const,
    planName: 'Monthly',
    expiryDate: '2024-04-01',
    daysRemaining: 5,
  },
];

const stats = [
  { label: 'Total Devices', value: '523', icon: Cpu, color: 'text-primary' },
  { label: 'Active Subscriptions', value: '412', icon: CreditCard, color: 'text-success' },
  { label: 'Expiring Soon', value: '28', icon: AlertTriangle, color: 'text-warning' },
  { label: 'Total Users', value: '498', icon: Users, color: 'text-secondary' },
];

type FilterType = 'all' | 'active' | 'expired' | 'suspended' | 'expiring-soon';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = 
      product.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filter === 'all' ||
      (filter === 'expiring-soon' && product.status === 'active' && product.daysRemaining <= 7) ||
      filter === product.status;

    return matchesSearch && matchesFilter;
  });

  const handleAction = (action: string, productId: string) => {
    toast.success(`${action} action triggered for ${productId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-water flex items-center justify-center">
                <Waves className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-heading font-bold">The Buraq</span>
                <Badge variant="outline" className="ml-2 text-xs border-secondary-foreground/30">
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
          className="mb-8"
        >
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage all registered devices and subscriptions
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
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
                      <p className="text-2xl sm:text-3xl font-heading font-bold">{stat.value}</p>
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
                <Button variant="outline" size="sm">
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
                    {(['all', 'active', 'expired', 'suspended', 'expiring-soon'] as FilterType[]).map((f) => (
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
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">{product.productId}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.userName}</p>
                            <p className="text-sm text-muted-foreground">{product.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{product.planName}</TableCell>
                        <TableCell>
                          <StatusIndicator status={product.status} />
                        </TableCell>
                        <TableCell>{new Date(product.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            product.daysRemaining <= 7 && product.status === 'active'
                              ? 'text-warning'
                              : product.status === 'expired'
                              ? 'text-destructive'
                              : ''
                          }`}>
                            {product.daysRemaining}
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
                              <DropdownMenuItem onClick={() => handleAction('View', product.productId)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {product.status !== 'active' && (
                                <DropdownMenuItem onClick={() => handleAction('Activate', product.productId)}>
                                  <Play className="w-4 h-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              {product.status === 'active' && (
                                <DropdownMenuItem onClick={() => handleAction('Suspend', product.productId)}>
                                  <Pause className="w-4 h-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('Extend', product.productId)}>
                                <Clock className="w-4 h-4 mr-2" />
                                Extend Subscription
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Cpu className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No devices found matching your criteria</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
