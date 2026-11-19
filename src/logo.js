// Logo ProdTrack en HTML autonome (styles inline) pour l'en-tête des PDF exportés.
// Reprend la pastille dégradé turquoise + mini-courbe blanche et le mot « ProdTrack ».
export const LOGO_HTML =
  '<div style="display:flex;align-items:center;gap:9px;margin-bottom:12px">' +
  '<span style="width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(140deg,#2dd4bf,#14b8a6);-webkit-print-color-adjust:exact;print-color-adjust:exact">' +
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 16 L10 11 L15 14 L20 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<circle cx="4" cy="16" r="1.7" fill="#fff"/><circle cx="10" cy="11" r="1.7" fill="#fff"/>' +
  '<circle cx="15" cy="14" r="1.7" fill="#fff"/><circle cx="20" cy="6" r="1.7" fill="#fff"/></svg>' +
  '</span>' +
  '<span style="font-size:16px;font-weight:800;letter-spacing:.04em;color:#0f172a">Prod<span style="color:#14b8a6">Track</span></span>' +
  '</div>'
