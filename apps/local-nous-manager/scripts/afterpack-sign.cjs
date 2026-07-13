// electron-builder afterPack hook: ad-hoc sign the packed .app.
// No Developer ID identity exists in this environment, so electron-builder skips
// signing entirely — but Apple Silicon requires a valid (at least ad-hoc) seal, and
// the DMG must carry the signed bundle. If a real identity is ever configured,
// electron-builder signs AFTER this hook and simply replaces the ad-hoc seal.
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--identifier', 'com.noesis.local-nous-manager', appPath],
    { stdio: 'inherit' }
  );
};
