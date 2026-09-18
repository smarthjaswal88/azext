/**
 * Behavioural checks for the persisted cart store.
 *
 * The store is plain JavaScript once compiled, so it can be exercised directly
 * against a localStorage stub — no browser needed. This covers the parts that
 * are easy to get quietly wrong: merging repeat additions, keeping two variants
 * of the same product apart, clamping quantities, removing only what was
 * bought, and surviving a refresh.
 *
 *   npm run check:cart
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// Compiled inside the project so the store's `react` and `zustand` imports
// resolve the same way they do at runtime. node_modules is already ignored.
const out = join(process.cwd(), "node_modules", ".cache", "cart-store-check");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
try {
  execFileSync(
    "npx",
    ["tsc", "src/lib/cart.ts", "src/lib/cart-store.ts",
     "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node",
     "--esModuleInterop", "--skipLibCheck", "--outDir", out],
    { stdio: "inherit" },
  );

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  let pass = 0;
  let fail = 0;
  const check = (label, actual, expected) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
      pass += 1;
      console.log(`  PASS  ${label}`);
    } else {
      fail += 1;
      console.log(`  FAIL  ${label}\n          got      ${a}\n          expected ${e}`);
    }
  };

  const require = createRequire(join(out, "x.js"));
  const mod = require(join(out, "cart-store.js"));
  const s = () => mod.useCartStore.getState();
  const items = () => s().items.map((i) => [i.variantId, i.quantity]);

  check("starts empty", items(), []);
  check("no hydration flag in store state", "hydrated" in s(), false);
  check("exposes useCartItems for server-safe reads", typeof mod.useCartItems, "function");

  s().addItem("cl-fieldhouse-tee-black-m", 2);
  check("add one", items(), [["cl-fieldhouse-tee-black-m", 2]]);
  s().addItem("cl-fieldhouse-tee-black-m", 3);
  check("repeat add merges into one line", items(), [["cl-fieldhouse-tee-black-m", 5]]);
  s().addItem("cl-fieldhouse-tee-olive-l", 1);
  check("two variants of one product stay separate", items(), [
    ["cl-fieldhouse-tee-black-m", 5],
    ["cl-fieldhouse-tee-olive-l", 1],
  ]);

  s().addItem("cl-fieldhouse-tee-black-m", 99);
  check("merge clamps at 10", items()[0], ["cl-fieldhouse-tee-black-m", 10]);
  s().setQuantity("cl-fieldhouse-tee-black-m", 50);
  check("setQuantity clamps at 10", items()[0], ["cl-fieldhouse-tee-black-m", 10]);
  s().setQuantity("cl-fieldhouse-tee-black-m", 0);
  check("setQuantity 0 removes the line", items(), [["cl-fieldhouse-tee-olive-l", 1]]);

  s().addItem("hp-verso-compact-navy", 2);
  s().addItem("hp-aureal-h9-midnight", 1);
  s().removeItem("hp-verso-compact-navy");
  check("removeItem drops one", items().map((i) => i[0]), [
    "cl-fieldhouse-tee-olive-l",
    "hp-aureal-h9-midnight",
  ]);
  s().removeItems(["hp-aureal-h9-midnight"]);
  check("removeItems drops only what was purchased", items(), [
    ["cl-fieldhouse-tee-olive-l", 1],
  ]);

  const raw = localStorage.getItem("shop-demo-cart-v1");
  check("persisted under a versioned key", raw !== null, true);
  check("persists items only", Object.keys(JSON.parse(raw).state), ["items"]);
  check("no prices persisted", raw.includes("Cents"), false);

  const reloaded = createRequire(join(out, "y.js"))(join(out, "cart-store.js")).useCartStore;
  check(
    "cart survives a refresh",
    reloaded.getState().items.map((i) => [i.variantId, i.quantity]),
    [["cl-fieldhouse-tee-olive-l", 1]],
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  rmSync(out, { recursive: true, force: true });
}
