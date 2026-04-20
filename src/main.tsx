import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import { AuthProvider } from "./contexts/AuthProvider";
import "./styles.css";

console.log("[Four Seasons] main.jsx loaded");
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element");
console.log("[Four Seasons] about to render");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

