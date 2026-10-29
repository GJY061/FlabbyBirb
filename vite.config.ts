import pluginChecker from "vite-plugin-checker";
import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    plugins: [pluginChecker({ typescript: true, overlay: false })],
});
