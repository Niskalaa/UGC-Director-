import React, { ReactNode, ErrorInfo, Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log("System: Booting v2.3...");

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary to catch render-phase errors
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: '#050505', 
          color: '#ef4444', 
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>System Failure</h2>
             <div style={{ 
               backgroundColor: 'rgba(239, 68, 68, 0.1)', 
               border: '1px solid rgba(239, 68, 68, 0.2)', 
               padding: '1.5rem', 
               borderRadius: '0.75rem',
               fontSize: '0.875rem',
               color: '#fca5a5',
               whiteSpace: 'pre-wrap',
               overflow: 'auto'
             }}>
               {this.state.error?.toString()}
             </div>
             <button 
               onClick={() => window.location.reload()}
               style={{
                 marginTop: '1.5rem',
                 padding: '0.75rem 1.5rem',
                 backgroundColor: '#ea580c',
                 color: 'white',
                 fontWeight: 'bold',
                 borderRadius: '0.5rem',
                 border: 'none',
                 cursor: 'pointer'
               }}
             >
               Reboot System
             </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("System: React mounted successfully.");
  } catch (err) {
    console.error("System: Critical Mount Error", err);
    container.innerHTML = `
      <div style="color:#ef4444; text-align:center; padding:50px; font-family: sans-serif;">
        <h3>System Failure</h3>
        <p>${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
} else {
  console.error("System: Root element missing.");
}