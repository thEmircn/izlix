// Electron fuse'lari (plan bolum 4): RunAsNode, NODE_OPTIONS ve --inspect kapali; ASAR butunlugu acik.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  const { appOutDir, packager } = context
  const platform = packager.platform.name // 'mac' | 'windows' | 'linux'
  const exe = platform === 'mac'
    ? join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'MacOS', packager.appInfo.productFilename)
    : platform === 'windows' ? join(appOutDir, `${packager.appInfo.productFilename}.exe`) : join(appOutDir, packager.executableName)
  await flipFuses(exe, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: platform === 'mac',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // ASAR butunluk dogrulamasi yalniz macOS ve Windows'ta desteklenir
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: platform !== 'linux',
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // Cerez sifreleme macOS Keychain erisimi ister; imzasiz/ad-hoc yerel paketlerde onay bekleyip sayfa yuklemesini kilitler.
    // Yalnizca imzali (CSC_LINK/CSC_NAME) veya acikca istenen derlemelerde acilir.
    [FuseV1Options.EnableCookieEncryption]: !!(process.env.CSC_LINK || process.env.CSC_NAME || process.env.IZLIX_COOKIE_ENCRYPTION === '1')
  })
}
