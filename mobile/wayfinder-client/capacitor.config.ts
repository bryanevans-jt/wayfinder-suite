import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.thejoshuatree.wayfinder",
  appName: "Wayfinder",
  webDir: "www",
  server: {
    url: "https://wayfinder.thejoshuatree.org",
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
