import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (productId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (productId: string, password: string) => {
    // Simulated API call - replace with real backend
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock validation
    if (productId && password.length >= 6) {
      setUser({
        id: '1',
        productId,
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+234 800 000 0000',
        address: '123 Pool Lane, Lagos',
        role: 'user',
      });
      return { success: true };
    }
    return { success: false, error: 'Invalid Product ID or Password' };
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock validation
    if (data.productId && data.email && data.password.length >= 6) {
      return { success: true };
    }
    return { success: false, error: 'Registration failed. Please check your details.' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        adminLogin,
        logout,
        register,
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
