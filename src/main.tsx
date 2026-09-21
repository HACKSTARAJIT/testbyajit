import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./hooks/useAuth.tsx";
import { DeviceExperienceProvider } from "./hooks/useDeviceExperience.tsx";

createRoot(document.getElementById("root")!).render(
  <DeviceExperienceProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </DeviceExperienceProvider>
);
