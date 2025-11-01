(function(){
  const STORAGE_KEY = 'cartItems';
  const FALLBACK_PREFIX = '__drm_market_cart__=';
  const COLOR_PRESETS = {
    'blanco': {
      color: '#f8fafc',
      opacity: 0.35,
      blend: 'screen',
      filter: 'grayscale(0.05) brightness(1.1) contrast(1.05)',
      background: '#f8fafc'
    },
    'negro': {
      color: '#0f172a',
      opacity: 0.85,
      blend: 'multiply',
      filter: 'grayscale(0.75) brightness(0.6) contrast(1.25)',
      background: '#e2e8f0'
    },
    'azul marino': {
      color: '#1e3a8a',
      opacity: 0.65,
      blend: 'multiply',
      filter: 'grayscale(0.25) saturate(1.2) brightness(0.98)',
      background: '#dbeafe'
    },
    'rojo': {
      color: '#dc2626',
      opacity: 0.6,
      blend: 'multiply',
      filter: 'grayscale(0.25) saturate(1.25) brightness(1)',
      background: '#fee2e2'
    },
    'verde': {
      color: '#047857',
      opacity: 0.55,
      blend: 'multiply',
      filter: 'grayscale(0.25) saturate(1.2) brightness(1.02)',
      background: '#d1fae5'
    }
  };

  function parseArray(input){
    if (input == null || input === '') return null;
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function readFromLocal(){
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function writeToLocal(items){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      return false;
    }
  }

  function readFromFallback(){
    if (!window.name || !window.name.startsWith(FALLBACK_PREFIX)) return null;
    return parseArray(window.name.slice(FALLBACK_PREFIX.length));
  }

  function writeToFallback(items){
    try {
      window.name = FALLBACK_PREFIX + JSON.stringify(items);
    } catch {
      /* ignore */
    }
  }

  function normalizeLegacyItems(list){
    if (!Array.isArray(list)) return [];
    return list.map((item)=>{
      if (typeof item !== 'object' || item === null) return { id: genId(), name: 'Producto', price: 0, quantity: 1, size: '', color: '', image: '' };
      return {
        id: item.id || genId(),
        name: typeof item.name === 'string' ? item.name : 'Producto',
        price: Number(item.price || 0) || 0,
        quantity: Math.max(1, Number(item.quantity || 1) || 1),
        size: typeof item.size === 'string' ? item.size : '',
        color: typeof item.color === 'string' ? item.color : '',
        image: typeof item.image === 'string' ? item.image : ''
      };
    });
  }

  function getColorPreset(name){
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    const preset = COLOR_PRESETS[key];
    if (!preset) return null;
    return { ...preset };
  }

  function readItems(){
    const localValue = parseArray(readFromLocal());
    if (localValue !== null) {
      const normalized = normalizeLegacyItems(localValue);
      writeToFallback(normalized);
      writeToLocal(normalized);
      return normalized;
    }

    const fallbackValue = readFromFallback();
    if (fallbackValue !== null) {
      const normalized = normalizeLegacyItems(fallbackValue);
      writeToLocal(normalized);
      return normalized;
    }
    return [];
  }

  function notifyChange(items){
    const snapshot = Array.isArray(items) ? items : readItems();
    updateBadge(snapshot);
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: snapshot } }));
  }

  function writeItems(items){
    const list = normalizeLegacyItems(Array.isArray(items) ? items : []);
    writeToFallback(list);
    if (!writeToLocal(list)) {
      // ensure badge updates even if localStorage is unavailable
      updateBadge(list);
    }
    notifyChange(list);
  }

  function formatPrice(n, currency='EUR'){ return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n); }
  function totalCount(items){ return items.reduce((a,i)=>a+Number(i.quantity||1),0); }
  function totalPrice(items){ return items.reduce((a,i)=>a + Number(i.price||0)*Number(i.quantity||1), 0); }
  function genId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

  function updateBadge(items){
    const source = Array.isArray(items) ? items : readItems();
    const count = totalCount(source);
    const targets = document.querySelectorAll('[data-cart-count]');
    if (!targets.length){
      const legacy = document.getElementById('cart-count');
      if (legacy) legacy.textContent = String(count);
      return;
    }
    targets.forEach((node)=>{ node.textContent = String(count); });
  }

  function addListener(cb){
    if (typeof cb !== 'function') return function noop(){};
    const handler = (event)=>{ cb(event?.detail?.items ?? readItems()); };
    const storageHandler = (e)=>{
      if (e.key === STORAGE_KEY) {
        const items = readItems();
        updateBadge(items);
        cb(items);
      }
    };
    window.addEventListener('cart:change', handler);
    window.addEventListener('storage', storageHandler);
    return function removeListener(){
      window.removeEventListener('cart:change', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }

  function parseUrlParams(){
    const p = new URLSearchParams(location.search);
    const name = p.get('name') || '';
    const price = p.get('price') ? Number(p.get('price')) : undefined;
    const image = p.get('image') || '';
    return { name, price, image };
  }

  const cartManager = {
    getItems: readItems,
    setItems: writeItems,
    clearCart: function(){ writeItems([]); },
    addItem: function(partial){
      const items = readItems();
      const normalized = {
        name: String(partial?.name ?? '').trim() || 'Producto',
        price: Number(partial?.price ?? 0) || 0,
        quantity: Math.max(1, Number(partial?.quantity ?? 1) || 1),
        size: String(partial?.size ?? '').trim(),
        color: String(partial?.color ?? '').trim(),
        image: String(partial?.image ?? '').trim()
      };
      const existingIndex = items.findIndex((item) =>
        item.name === normalized.name &&
        item.size === normalized.size &&
        item.color === normalized.color &&
        Number(item.price || 0) === normalized.price &&
        (item.image || '') === normalized.image
      );

      if (existingIndex >= 0) {
        const existing = items[existingIndex];
        const updated = { ...existing, quantity: Number(existing.quantity || 1) + normalized.quantity };
        items[existingIndex] = updated;
        writeItems(items);
        return updated.id;
      }

      const newItem = { id: genId(), ...normalized };
      items.push(newItem);
      writeItems(items);
      return newItem.id;
    },
    removeItem: function(id){
      const items = readItems().filter(i => i.id !== id);
      writeItems(items);
    },
    updateQuantity: function(id, qty){
      const q = Math.max(1, Number(qty||1));
      const items = readItems().map(i => i.id === id ? { ...i, quantity: q } : i);
      writeItems(items);
    },
    getTotalCount: function(items){ return totalCount(Array.isArray(items) ? items : readItems()); },
    getTotalPrice: function(items){ return totalPrice(Array.isArray(items) ? items : readItems()); },
    formatPrice,
    addListener,
    parseUrlParams,
    updateBadge,
    getColorPreset
  };

  window.cartManager = cartManager;
  window.updateCartCount = function(){ updateBadge(); }; // backward compatibility

  window.addEventListener('storage', (e)=>{ if (e.key === STORAGE_KEY) updateBadge(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>updateBadge());
  } else {
    updateBadge();
  }
})();


