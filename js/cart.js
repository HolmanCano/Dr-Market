(function(){
  const STORAGE_KEY = 'cartItems';

  function readItems(){
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function writeItems(items){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyChange(items);
  }
  function notifyChange(items){
    const snapshot = Array.isArray(items) ? items : readItems();
    updateBadge(snapshot);
    window.dispatchEvent(new CustomEvent('cart:change', { detail: { items: snapshot } }));
  }

  function formatPrice(n, currency='EUR'){ return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n); }
  function totalCount(items){ return items.reduce((a,i)=>a+Number(i.quantity||1),0); }
  function totalPrice(items){ return items.reduce((a,i)=>a + Number(i.price||0)*Number(i.quantity||1), 0); }
  function genId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

  function updateBadge(items){
    const source = Array.isArray(items) ? items : readItems();
    const count = totalCount(source);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = String(count);
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


