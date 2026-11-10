// Sayfa adresini izlix://open?url=... ile uygulamaya iletir. Yalnizca http(s) adresler gonderilir.
const open = (url) => {
  if (!url || !/^https?:\/\//i.test(url)) return
  chrome.tabs.create({ url: 'izlix://open?url=' + encodeURIComponent(url), active: false }, (tab) => {
    setTimeout(() => { if (tab && tab.id != null) chrome.tabs.remove(tab.id).catch(() => {}) }, 1500)
  })
}
chrome.action.onClicked.addListener((tab) => open(tab.url))
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'open-in-db', title: "Izlix'da aç", contexts: ['page', 'link'] })
})
chrome.contextMenus.onClicked.addListener((info, tab) => open(info.linkUrl || info.pageUrl || (tab && tab.url)))
