import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker in production only.
//
// In dev it would cache the Vite shell and shadow hot reloads, which is a
// confusing failure to debug. `updateViaCache: 'none'` means the worker script
// itself is always revalidated, so a deploy is never held back by a stale copy
// of sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((err) => console.warn('[sw] registration failed', err));
  });
}
