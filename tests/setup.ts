import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// next-i18next's useTranslation in tests: fall back to the second arg.
vi.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
      if (typeof fallback === "string") {
        if (opts) {
          return fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ""));
        }
        return fallback;
      }
      return key;
    },
    i18n: { language: "ko" },
  }),
  appWithTranslation: <T,>(x: T) => x,
}));

// next/router — pages under test read router.query and router.push.
vi.mock("next/router", () => {
  const push = vi.fn();
  const replace = vi.fn();
  const reload = vi.fn();
  return {
    useRouter: () => ({
      query: {},
      pathname: "/admin/brokers/[id]",
      locale: "ko",
      push,
      replace,
      reload,
    }),
  };
});
