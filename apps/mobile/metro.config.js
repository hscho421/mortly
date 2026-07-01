// Metro config for the Mortly Expo app inside the npm-workspaces monorepo.
// Teaches Metro to (a) watch the whole repo (so @mortly/core resolves) and
// (b) resolve hoisted deps from the root node_modules, then wraps it with
// NativeWind so Tailwind classes work in React Native.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the monorepo so changes in packages/core are picked up.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Prefer the workspace copy of shared singletons where relevant.
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./global.css" });
