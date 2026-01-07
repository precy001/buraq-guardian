import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  productId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  role: 'user' | 'admin';
}

export interface Subscription {
  id: string;
  productId: string;
  planName: string;
  status: 'active' | 'expired' | 'suspended';
  startDate: string;
  expiryDate: string;
  daysRemaining: number;
  totalDays: number;
}

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (productId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  refreshSubscription: () => Promise<void>;
}

export interface RegisterData {
  productId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost/buraq-guardian/api';
const STORAGE_KEY = 'buraq_auth_session';

// Helper to load session from localStorage
const loadSession = (): { user: User | null; subscription: Subscription | null } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { user: parsed.user || null, subscription: parsed.subscription || null };
    }
  } catch (e) {
    console.error('Failed to load session:', e);
  }
  return { user: null, subscription: null };
};

// Helper to save session to localStorage
const saveSession = (user: User | null, subscription: Subscription | null) => {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, subscription }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const { user: storedUser, subscription: storedSubscription } = loadSession();
    if (storedUser) {
      setUser(storedUser);
      setSubscription(storedSubscription);
    }
    setIsLoading(false);
  }, []);

  // Persist session on changes
  useEffect(() => {
    if (!isLoading) {
      saveSession(user, subscription);
    }
  }, [user, subscription, isLoading]);

  const login = useCallback(async (productId: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          password: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const userData = data.data.user;
        const subData = data.data.subscription;

        setUser({
          id: userData.id,
          productId: userData.product_id,
          fullName: userData.full_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          address: userData.home_address || '',
          role: 'user',
        });

        if (subData) {
          setSubscription({
            id: subData.id,
            productId: userData.product_id,
            planName: subData.plan_name,
            status: subData.status,
            startDate: subData.start_date,
            expiryDate: subData.end_date,
            daysRemaining: subData.days_remaining,
            totalDays: subData.total_days,
          });
        } else {
          setSubscription(null);
        }

        return { success: true };
      }
      return { success: false, error: data.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, []);

  const adminLogin = useCallback(async (email: string, password: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (email && password.length >= 6) {
      setUser({
        id: 'admin-1',
        productId: 'ADMIN',
        fullName: 'Admin User',
        email,
        phone: '',
        address: '',
        role: 'admin',
      });
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: data.productId,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone || null,
          home_address: data.address || null,
          password: data.password,
          confirm_password: data.password,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.message || 'Registration failed' };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setSubscription(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!user?.productId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/subscriptions/status.php?product_id=${encodeURIComponent(user.productId)}`);
      const data = await response.json();

      if (data.success && data.data?.subscription) {
        const subData = data.data.subscription;
        setSubscription({
          id: subData.id,
          productId: user.productId,
          planName: subData.plan_name,
          status: subData.status,
          startDate: subData.start_date,
          expiryDate: subData.end_date,
          daysRemaining: subData.days_remaining,
          totalDays: subData.total_days,
        });
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  }, [user?.productId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        adminLogin,
        logout,
        register,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
