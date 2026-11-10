// Electron fuse'lari (plan bolum 4): RunAsNode, NODE_OPTIONS ve --inspect kapali; ASAR butunlugu acik.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  const { appOutDir, packager } = context
  const exe = join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'MacOS', packager.appInfo.productFilename)
  await flipFuses(exe, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true
  })
}
