const esbuild = require('esbuild');

const shared = {
  bundle: true,
  platform: 'browser',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: false,
  mainFields: ['browser', 'module', 'main'],
  sourcemap: false,
};

Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ['src/content.jsx'],
    outfile: 'dist/content.js',
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: { '.jsx': 'jsx', '.js': 'js' },
  }),
  esbuild.build({
    ...shared,
    entryPoints: ['src/background.js'],
    outfile: 'dist/background.js',
    // mark chrome as external – it's provided by the browser
    external: ['chrome'],
  }),
]).then(() => {
  console.log('Build complete → dist/content.js, dist/background.js');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
