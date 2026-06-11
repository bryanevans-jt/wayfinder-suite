import type { SerializeOptions } from "cookie";

export type SupabaseCookieToSet = {
  name: string;
  value: string;
  options?: SerializeOptions;
};
