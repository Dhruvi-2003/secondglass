import * as esbuild from "esbuild";
import { mkdir, copyFile, readFile, writeFile, cp } from "node:fs/promises";
import {createHash} from "node:crypto";
const version = value => createHash('sha256').update(value).digest('hex').slice(0,16);
const pages = process.argv.includes("--pages");
const out = pages ? "../docs-site" : "../backend/src/main/resources/static";
await mkdir(out, { recursive: true });
await copyFile("index.html", `${out}/index.html`);
await cp("assets/brands", `${out}/assets/brands`, {recursive:true});
let catalogueVersion = '';
if (pages) {
  const {prepareSnapshot} = await import('./prepare-pages.mjs');
  const snapshot = prepareSnapshot(JSON.parse(await readFile('../catalogue/live.json','utf8')));
  const data=JSON.stringify(snapshot);
  catalogueVersion=version(data);
  await writeFile(`${out}/catalogue.json`,data);
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
    "__CATALOGUE_VERSION__": JSON.stringify(catalogueVersion),
    "process.env.NODE_ENV": '"production"' },
  plugins: [{name:'versioned-assets',setup(build) {
    build.onEnd(async result => {
      if(result.errors.length) return;
      const js=version(await readFile(`${out}/app.js`)), css=version(await readFile(`${out}/app.css`));
      const html=(await readFile('index.html','utf8')).replace('./app.js',`./app.js?v=${js}`).replace('./app.css',`./app.css?v=${css}`);
      await writeFile(`${out}/index.html`,html);
    });
  }}],
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
