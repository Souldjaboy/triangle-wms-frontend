import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trianglewmspro.app",
  appName: "Triangle WMS Pro",
  webDir: "public",
  server: {
    url: "https://trianglewmspro.com",
    cleartext: false,
  },
  android: {
    backgroundColor: "#111111",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
