import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "./lib/notifications";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for notifications (prod + dev)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { registerSW(); });
}
