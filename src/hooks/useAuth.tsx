import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    loading: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const { user } = await res.json();
          setState({
            user,
            token,
            isAuthenticated: true,
            loading: false,
          });
        } else {
          localStorage.removeItem('token');
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
          });
        }
      } catch (err) {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Invalid credentials. For local access use: admin@example.com / admin123');
      }
      let errorMessage = 'Login failed';
      try {
        const error = await res.json();
        errorMessage = error.message || errorMessage;
      } catch (e) {
        try {
          const text = await res.clone().text(); // Use clone to allow multiple reads
          errorMessage = `Server Raw Response (${res.status}): ${text.substring(0, 150)}`;
        } catch (textErr) {
          errorMessage = `Server Error (${res.status}) - Could not read response body`;
        }
      }
      throw new Error(errorMessage);
    }

    const { token, user } = await res.json();
    localStorage.setItem('token', token);
    setState({
      user,
      token,
      isAuthenticated: true,
      loading: false,
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
