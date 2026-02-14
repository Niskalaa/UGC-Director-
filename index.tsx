import React, { ReactNode, ErrorInfo, Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App.jsx"; // ✅ pastikan path ini benar

console.log("System: Booting...");

type EBState = { hasError: boolean; error: Error | null };

class ErrorBoundary extends Component<{ children?: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React Error Boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui", color: "#b91c1c" }}>
          <h2>System Failure</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" missing');

createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
