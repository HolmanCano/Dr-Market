(function(){
  const STORAGE_KEY = 'cartItems';
  const FALLBACK_PREFIX = '__drm_market_cart__=';

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

  function readItems(){
    const localValue = parseArray(readFromLocal());
    if (localValue !== null) {
      writeToFallback(localValue);
      return localValue;
    }

    const fallbackValue = readFromFallback();
    if (fallbackValue !== null) {
      writeToLocal(fallbackValue);
      return fallbackValue;
    }
    return [];
  }

  function notifyChange(items){
    const snapshot = Array.isArray(items) ? items : readItems();
    updateBadge(snapshot);
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: snapshot } }));
  }

  function writeItems(items){
    const list = Array.isArray(items) ? items : [];
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
        image: String(partial?.image ?? '').trim()
      };
      const existingIndex = items.findIndex((item) =>
        item.name === normalized.name &&
        item.size === normalized.size &&
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
    updateBadge
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


