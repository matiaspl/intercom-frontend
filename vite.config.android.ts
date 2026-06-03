/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    define: {
      "import.meta.env.VITE_MOBILE_TARGET": JSON.stringify("android"),
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
      },
    },
    plugins: [
      {
        name: "android-entry",
        enforce: "pre",
        transformIndexHtml(html) {
          return html.replace(
            /src=(["'])\/src\/main\.tsx\1/,
            'src="/src/main.android.tsx"'
          );
        },
      },
    ],
  })
);
