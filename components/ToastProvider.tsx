import React from 'react';
import toast, { Toaster } from 'react-hot-toast';

export interface ToastOptions {
  title?: string;
  description: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
}

export interface ToastContextType {
  addToast: (options: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const addToast = React.useCallback(({ title, description, variant = 'default', duration = 4000 }: ToastOptions) => {
    const message = title ? `${title}: ${description}` : description;
    
    switch (variant) {
      case 'success':
        toast.success(message, { duration });
        break;
      case 'destructive':
      case 'warning':
        toast.error(message, { duration });
        break;
      default:
        toast(message, { duration });
    }
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#4F46E5',
              secondary: '#fff',
            },
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};