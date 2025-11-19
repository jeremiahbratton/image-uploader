const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['public/src/main.js'],
  bundle: true,
  outfile: 'public/dist/bundle.js',
  platform: 'browser',
  target: ['es2020'],
  format: 'iife',
  minify: true,
  sourcemap: true
}).then(() => {
  console.log('Build completed successfully');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});

