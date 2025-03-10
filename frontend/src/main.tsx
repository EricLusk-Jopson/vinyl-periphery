import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import queryClient from "./api/client";
import { Toaster } from "./components/ui/toaster";
import { CacheProvider } from "./contexts/cache/CacheContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CacheProvider>
        <App />
        <Toaster />
      </CacheProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
