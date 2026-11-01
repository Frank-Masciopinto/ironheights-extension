// Runs in the page's own JS world (MAIN) on supported sites only. Copy buttons call
// navigator.clipboard.writeText, which fires no copy event, so we pass the copied text to the
// extension's content script with window.postMessage. Nothing leaves the page here.
(() => {
  const clip = navigator.clipboard as any;
  if (!clip || clip.__ihHooked) return;
  const orig = clip.writeText?.bind(clip);
  if (!orig) return;
  clip.__ihHooked = true;
  clip.writeText = (text: string) => {
    try { if (typeof text === 'string' && text.length < 20000) window.postMessage({ __ironheightsCopy: text }, location.origin); } catch {}
    return orig(text);
  };
})();
