import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),
    sites(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      inspectorPort: false,
      config: {
        main: "./worker/index.ts",
        d1_databases: [{binding:"DB",database_name:"site-creator-d1",database_id:"00000000-0000-4000-8000-000000000000"}],
        compatibility_flags: ["nodejs_compat"],
      },
    }),
  ],
});
