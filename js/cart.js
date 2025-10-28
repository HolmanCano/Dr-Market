(function(){
  const STORAGE_KEY = 'cartItems';

  function readItems(){
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function writeItems(items){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyChange();
  }
  function notifyChange(){
    updateBadge();
    window.dispatchEvent(new CustomEvent('cart:change'));
  }

  function formatPrice(n, currency='EUR'){ return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n); }
  function totalCount(items){ return items.reduce((a,i)=>a+Number(i.quantity||1),0); }
  function totalPrice(items){ return items.reduce((a,i)=>a + Number(i.price||0)*Number(i.quantity||1), 0); }
  function genId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

  function updateBadge(){
    const count = totalCount(readItems());
    const el = document.getElementById('cart-count');
    if (el) el.textContent = String(count);
  }

  function addListener(cb){
    window.addEventListener('cart:change', cb);
    window.addEventListener('storage', (e)=>{ if (e.key === STORAGE_KEY) { updateBadge(); cb(); } });
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
      const item = { id: genId(), name: '', price: 0, quantity: 1, size: '', image: '', ...partial };
      items.push(item);
      writeItems(items);
      return item.id;
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
    getTotalCount: function(){ return totalCount(readItems()); },
    getTotalPrice: function(){ return totalPrice(readItems()); },
    formatPrice,
    addListener,
    parseUrlParams,
    updateBadge
  };

  window.cartManager = cartManager;
  window.updateCartCount = updateBadge; // backward compatibility

  document.addEventListener('DOMContentLoaded', updateBadge);
})();


