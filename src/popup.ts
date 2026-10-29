const api = (globalThis as any).browser ?? chrome;
const box = document.getElementById('autoBadge') as HTMLInputElement;
api.storage.sync.get({ autoBadge: true }).then((v: any) => { box.checked = v.autoBadge; });
box.addEventListener('change', () => api.storage.sync.set({ autoBadge: box.checked }));
document.getElementById('ver')!.textContent = 'v' + api.runtime.getManifest().version;
document.getElementById('scan')!.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = (document.getElementById('url') as HTMLInputElement).value.trim();
  api.tabs.create({ url: api.runtime.getURL('results.html?url=' + encodeURIComponent(url)) });
});
