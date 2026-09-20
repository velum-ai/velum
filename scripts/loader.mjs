// Teaches plain `node` the `@/*` import alias (same one jsconfig.json / Next
// use). Load it with:  node --import ./scripts/loader.mjs <file>
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.resolve(process.cwd(), "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      let target = path.join(SRC, specifier.slice(2));
      if (!existsSync(target)) {
        if (existsSync(`${target}.js`)) target = `${target}.js`;
        else if (existsSync(path.join(target, "index.js")))
          target = path.join(target, "index.js");
      }
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  },
});
