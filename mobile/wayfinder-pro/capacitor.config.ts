import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.thejoshuatree.wayfinderpro",
  appName: "Wayfinder Pro",
  webDir: "www",
  server: {
    url: "https://wayfinder-pro.thejoshuatree.org",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
