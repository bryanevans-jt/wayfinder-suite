import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.thejoshuatree.reports",
  appName: "Joshua Tree Reports",
  webDir: "www",
  server: {
    url: "https://wayfinder-reports.thejoshuatree.org",
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
