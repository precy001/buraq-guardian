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

interface AdminSession {
  token: string;
  admin: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  adminSession: AdminSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (productId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  adminLogout: () => Promise<void>;
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
const ADMIN_STORAGE_KEY = 'buraq_admin_session';

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

// Helper to load admin session from localStorage
const loadAdminSession = (): AdminSession | null => {
  try {
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load admin session:', e);
  }
  return null;
};

// Helper to save session to localStorage
const saveSession = (user: User | null, subscription: Subscription | null) => {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, subscription }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

// Helper to save admin session to localStorage
const saveAdminSession = (session: AdminSession | null) => {
  if (session) {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const { user: storedUser, subscription: storedSubscription } = loadSession();
    const storedAdminSession = loadAdminSession();
    
    if (storedUser) {
      setUser(storedUser);
      setSubscription(storedSubscription);
    }
    
    if (storedAdminSession) {
      setAdminSession(storedAdminSession);
      // Set user for admin
      setUser({
        id: String(storedAdminSession.admin.id),
        productId: 'ADMIN',
        fullName: storedAdminSession.admin.username,
        email: storedAdminSession.admin.email,
        phone: '',
        address: '',
        role: 'admin',
      });
    }
    
    setIsLoading(false);
  }, []);

  // Persist session on changes
  useEffect(() => {
    if (!isLoading) {
      if (user?.role !== 'admin') {
        saveSession(user, subscription);
      }
    }
  }, [user, subscription, isLoading]);

  // Persist admin session on changes
  useEffect(() => {
    if (!isLoading) {
      saveAdminSession(adminSession);
    }
  }, [adminSession, isLoading]);

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
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const session: AdminSession = {
          token: data.data.token,
          admin: data.data.admin,
        };
        
        setAdminSession(session);
        setUser({
          id: String(data.data.admin.id),
          productId: 'ADMIN',
          fullName: data.data.admin.username,
          email: data.data.admin.email,
          phone: '',
          address: '',
          role: 'admin',
        });
        
        return { success: true };
      }
      return { success: false, error: data.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
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
    setAdminSession(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }, []);

  const adminLogout = useCallback(async () => {
    if (adminSession?.token) {
      try {
        await fetch(`${API_BASE_URL}/admin/logout.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminSession.token}`,
          },
        });
      } catch (error) {
        console.error('Admin logout error:', error);
      }
    }
    
    setUser(null);
    setAdminSession(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }, [adminSession?.token]);

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
        adminSession,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        adminLogin,
        logout,
        adminLogout,
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
