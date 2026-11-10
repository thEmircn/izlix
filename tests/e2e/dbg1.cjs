module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`document.cookie='sess=abc; path=/'; 0`)
  const c = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'Network.getCookies', {urls:['http://localhost:5173/']})`)
  out.cookies = c
  out.set1 = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'Network.setCookie', {name:'sess',value:'changed',url:'http://localhost:5173/',domain:'localhost',path:'/',secure:false,httpOnly:false}).catch(e=>String(e))`)
  out.set2 = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'Network.setCookie', {name:'sess',value:'changed2',url:'http://localhost:5173/'}).catch(e=>String(e))`)
  out.after = await pageEval(`document.cookie`)
  await shellEval(`window.izlix.dtEnable(${JSON.stringify(id)}, 'elements')`)
  out.doc = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'DOM.getDocument', {depth:2,pierce:true}).then(r=>!!r&&!!r.root).catch(e=>String(e))`)
  return out
}
