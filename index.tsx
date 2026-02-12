
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
          backgroundColor: '#f8fafc', 
          color: '#ef4444', 
          padding: '20px',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ maxWidth: '600px', width: '100%', backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#0f172a' }}>System Failure</h2>
             <div style={{ 
               backgroundColor: '#fef2f2', 
               border: '1px solid #fee2e2', 
               padding: '1.5rem', 
               borderRadius: '0.75rem',
               fontSize: '0.875rem',
               color: '#b91c1c',
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
                 cursor: 'pointer',
                 width: '100%'
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
      <div style="color:#ef4444; text-align:center; padding:50px; font-family: sans-serif; background: #f8fafc; height: 100vh;">
        <h3 style="color: #0f172a;">System Failure</h3>
        <p>${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
} else {
  console.error("System: Root element missing.");
}
