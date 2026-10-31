import * as esbuild from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
const pages = process.argv.includes("--pages");
const out = pages ? "../docs-site" : "../backend/src/main/resources/static";
await mkdir(out, { recursive: true });
await copyFile("index.html", `${out}/index.html`);
if (pages) {
  const {prepareSnapshot} = await import('./prepare-pages.mjs');
  const snapshot = prepareSnapshot(JSON.parse(await readFile('../catalogue/live.json','utf8')));
  await writeFile(`${out}/catalogue.json`,JSON.stringify(snapshot));
  await writeFile(`${out}/.nojekyll`,'');
}
const options = {
  entryPoints: ["src/main.jsx"],
  bundle: true,
  outfile: `${out}/app.js`,
  minify: true,
  sourcemap: false,
  jsx: "automatic",
  target: ["es2022"],
  define: { "__STATIC_PAGES__": String(pages),
    "process.env.NODE_ENV": '"production"' },
};
if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(
    "Watching frontend. Restart Spring Boot after changes to serve rebuilt resources.",
  );
} else {
  await esbuild.build(options);
  console.log(pages ? "GitHub Pages snapshot built in docs-site." : "React bundle ready for Spring Boot.");
}
