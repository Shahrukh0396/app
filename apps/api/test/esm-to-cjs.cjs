const esbuild = require('esbuild');
const { pathToFileURL } = require('url');

/** Jest 30 on Node 22 cannot require() Nest 12's ESM build. Downlevel those files to CJS. */
module.exports = {
  process(sourceText, sourcePath) {
    const fileUrl = JSON.stringify(pathToFileURL(sourcePath).href);
    const patched = sourceText.replaceAll('import.meta.url', fileUrl);
    const result = esbuild.transformSync(patched, {
      loader: 'js',
      format: 'cjs',
      target: 'es2022',
      supported: { 'dynamic-import': false },
      sourcefile: sourcePath,
    });
    return { code: result.code };
  },
};
