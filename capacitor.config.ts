import type { CapacitorConfig } from "@capacitor/cli";

const product = String(process.env.NEXT_PUBLIC_APP_PRODUCT || "triangle").toLowerCase();
const mobileApps = {
  triangle: {
    appId: "com.triangle.wmspro",
    appName: "Triangle WMS Pro",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://trianglewmspro.com",
    backgroundColor: "#111111",
  },
  malilink: {
    appId: "com.malilink.global",
    appName: "MaliLink Global",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://malilinkglobal.com",
    backgroundColor: "#07152f",
  },
  hafiya: {
    appId: "com.hafiya.lab",
    appName: "HAFIYA Laboratoire",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://hafiyalab.com",
    backgroundColor: "#0f7a55",
  },
} as const;

const app = product === "malilink" || product === "hafiya" ? mobileApps[product] : mobileApps.triangle;

const config: CapacitorConfig = {
  appId: app.appId,
  appName: app.appName,
  webDir: "public",
  server: {
    url: app.url,
    cleartext: false,
  },
  android: {
    backgroundColor: app.backgroundColor,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
