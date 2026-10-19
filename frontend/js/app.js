import {
  currentUser,
  currentUserProfile,
  initAuthListener,
  loginUser,
  registerUser,
  logoutUser,
  requestPasswordReset,
  resendVerificationEmail,
  subscribeAuth
} from "./auth.js";
import {
  seedDatabaseIfEmpty,
  fetchFarmers,
  fetchProducts,
  cachedFarmers,
  cachedProducts,
  fetchReviews,
  addReview
} from "./database.js";
import {
  cartItems,
  wishlistItems,
  loadCartAndWishlist,
  addToCart,
  updateCartQty,
  removeFromCart,
  toggleWishlist,
  getCartTotals,
  getProduct,
  subscribeCart
} from "./cart.js";
import { placeOrder } from "./orders.js";
import { renderDashboard } from "./dashboard.js";

/* ---------------- STATE ---------------- */
const state = {
  filters: { search:'', cat:'All', sort:'popular', maxPrice:99999, loc:'all', inStockOnly:false },
  browsing: [],
  purchases: [],
  activeProductId: null,
  tempRating: 0
};

const CATEGORIES = ['All','Vegetables','Fruits','Grains','Dairy','Spices','Pulses'];
const CAT_EMOJI = { All:'🌿', Vegetables:'🥬', Fruits:'🍎', Grains:'🌾', Dairy:'🥛', Spices:'🌶️', Pulses:'🫘' };

/* ---------------- HELPERS ---------------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const farmerOf = id => cachedFarmers.find(f => f.id === id) || { farm:'Local Organic Farm', location:'Tamil Nadu', name:'Local Farmer' };

export function toast(title, msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const ico = type === 'err' ? '⛔' : type === 'warn' ? '⚠️' : '✅';
  el.innerHTML = `<span class="t-ico">${ico}</span><div><b>${title}</b><p>${msg}</p></div>`;
  const wrap = $('#toastWrap');
  if (wrap) {
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
  }
}

function bumpBadge(el) {
  if (!el) return;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

/* ---------------- MODALS / DRAWERS ---------------- */
export function openDrawer(id) {
  $('#overlay').classList.add('show');
  $('#' + id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function openModal(id) {
  $('#overlay').classList.add('show');
  $('#' + id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function closeAll() {
  $('#overlay').classList.remove('show');
  $$('.drawer').forEach(d => d.classList.remove('show'));
  $$('.modal').forEach(m => m.classList.remove('show'));
  const userDrop = $('#userDropdown');
  if (userDrop) userDrop.classList.remove('show');
  document.body.style.overflow = '';
}

/* ---------------- PRODUCTS RENDERING ---------------- */
function getFilteredProducts() {
  const f = state.filters;
  let list = cachedProducts.filter(p => {
    const farmer = farmerOf(p.farmerId);
    if (f.cat !== 'All' && p.cat !== f.cat) return false;
    if (p.price > f.maxPrice) return false;
    if (f.loc !== 'all' && farmer.location !== f.loc) return false;
    if (f.inStockOnly && p.stock <= 0) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = (p.name + ' ' + p.cat + ' ' + (farmer.farm || '') + ' ' + (farmer.location || '') + ' ' + (p.desc || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  switch (f.sort) {
    case 'priceLow':  list.sort((a,b) => a.price - b.price); break;
    case 'priceHigh': list.sort((a,b) => b.price - a.price); break;
    case 'rating':    list.sort((a,b) => (b.rating||5) - (a.rating||5)); break;
    case 'name':      list.sort((a,b) => a.name.localeCompare(b.name)); break;
    default:          list.sort((a,b) => (b.reviews||0) - (a.reviews||0));
  }
  return list;
}

function stockInfo(p) {
  if (p.stock <= 0)  return { cls:'out', label:'Out of Stock' };
  if (p.stock <= 15) return { cls:'low', label:`Only ${p.stock} left` };
  return { cls:'', label:'In Stock' };
}

function productCardHTML(p) {
  const farmer = farmerOf(p.farmerId);
  const s = stockInfo(p);
  const wished = wishlistItems.includes(p.id);
  const g = p.g || ['#eaf7ee','#cfeada'];

  return `
    <article class="product-card" data-id="${p.id}">
      <div class="pc-media" style="--g1:${g[0]};--g2:${g[1]}">
        <span class="pc-tag">${p.cat}</span>
        <button class="pc-wish ${wished?'on':''}" data-wish="${p.id}" title="Wishlist">${wished?'❤️':'🤍'}</button>
        <span class="pc-emoji">${p.emoji || '🌿'}</span>
        <span class="pc-stock ${s.cls}">${s.label}</span>
      </div>
      <div class="pc-body">
        <h3>${p.name}</h3>
        <p class="pc-farmer">👨‍🌾 ${farmer.farm} · ${(farmer.location||'TN').split(',')[0]}</p>
        <div class="pc-meta">
          <span class="pc-rating">★ ${(p.rating||5).toFixed(1)} <small>(${p.reviews||0})</small></span>
          <span class="pc-price">${money(p.price)}<span>/${p.unit}</span></span>
        </div>
        <button class="pc-add" data-add="${p.id}" ${p.stock<=0?'disabled':''}>
          ${p.stock<=0 ? 'Out of Stock' : '🛒 Add to Cart'}
        </button>
      </div>
    </article>`;
}

export function renderProducts() {
  const list = getFilteredProducts();
  const grid = $('#productGrid');
  if ($('#resultCount')) $('#resultCount').textContent = list.length;
  if (grid) {
    grid.innerHTML = list.length
      ? list.map(productCardHTML).join('')
      : `<div class="empty-state">
           <div class="big">🔍</div>
           <h3>No products match your filters</h3>
           <p>Try widening your price range or clearing the search query.</p>
         </div>`;
  }
  renderRecommendations();
}

function renderChips() {
  const cEl = $('#catChips');
  if (!cEl) return;
  cEl.innerHTML = CATEGORIES.map(c => `
    <button class="chip ${state.filters.cat===c?'active':''}" data-cat="${c}">
      <span>${CAT_EMOJI[c]}</span>${c}
    </button>`).join('');
}

function renderHeroRows() {
  const top = [...cachedProducts].sort((a,b) => (b.rating||5) - (a.rating||5)).slice(0,3);
  const rows = $('#heroRows');
  if (!rows) return;
  rows.innerHTML = top.map(p => {
    const f = farmerOf(p.farmerId);
    return `<div class="hv-row">
      <span class="em">${p.emoji||'🌿'}</span>
      <div class="info"><b>${p.name}</b><small>${f.farm}</small></div>
      <span class="pr">${money(p.price)}</span>
    </div>`;
  }).join('');
}

export function renderFarmers() {
  const grid = $('#farmerGrid');
  if (!grid) return;
  grid.innerHTML = cachedFarmers.map(f => {
    const count = cachedProducts.filter(p => p.farmerId === f.id).length;
    return `<div class="farmer-card">
      <div class="fc-top">
        <div class="fc-avatar">${f.avatar || '👨‍🌾'}</div>
        <div>
          <div class="fc-name">${f.name} ${f.verified?'<span class="verified">✓ VERIFIED</span>':'<span class="unverified">PENDING</span>'}</div>
          <small>${f.farm}</small>
        </div>
      </div>
      <p class="fc-bio">${f.bio || 'Sustainable local farmer.'}</p>
      <div class="fc-stats">
        <div><b>${(f.rating||4.8).toFixed(1)}★</b><span>Rating</span></div>
        <div><b>${count}</b><span>Products</span></div>
        <div><b>${(f.location||'TN').split(',')[0]}</b><span>Location</span></div>
        <div><b>${2026 - (f.since||2020)}y</b><span>Experience</span></div>
      </div>
    </div>`;
  }).join('');

  // Update hero stats
  if ($('#statFarmers')) $('#statFarmers').textContent = cachedFarmers.filter(f=>f.verified).length || cachedFarmers.length;
  if ($('#statProducts')) $('#statProducts').textContent = cachedProducts.length;

  // Populate location select
  const locSel = $('#locSelect');
  if (locSel && locSel.options.length <= 1) {
    const locs = [...new Set(cachedFarmers.map(f => f.location).filter(Boolean))].sort();
    locs.forEach(l => {
      const o = document.createElement('option');
      o.value = l; o.textContent = l;
      locSel.appendChild(o);
    });
  }
}

function renderRecommendations() {
  const rGrid = $('#recoGrid');
  if (!rGrid) return;
  const inCart = cartItems.map(c => c.id);
  const picks = [...cachedProducts]
    .filter(p => !inCart.includes(p.id) && p.stock > 0)
    .sort((a,b) => (b.rating||5) - (a.rating||5))
    .slice(0, 4);

  rGrid.innerHTML = picks.map(productCardHTML).join('');
}

/* ---------------- CART & WISHLIST UI ---------------- */
function renderCartUI() {
  const body = $('#cartBody');
  const foot = $('#cartFoot');
  if (!body || !foot) return;

  if (cartItems.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="big">🛒</div><h3>Your cart is empty</h3><p>Add some farm-fresh produce to get started.</p></div>`;
    foot.innerHTML = `<button class="btn btn-ghost btn-block" data-close="cartDrawer">Continue Shopping</button>`;
    updateBadges();
    return;
  }

  body.innerHTML = cartItems.map(c => {
    const p = getProduct(c.id);
    if (!p) return '';
    const f = farmerOf(p.farmerId);
    return `<div class="cart-item">
      <div class="ci-em">${p.emoji||'🌿'}</div>
      <div class="ci-info">
        <b>${p.name}</b>
        <small>${f.farm}</small>
        <span class="ci-price">${money(p.price)}/${p.unit}</span>
        <div class="qty">
          <button data-qty="${p.id}" data-d="-1">−</button>
          <span>${c.qty}</span>
          <button data-qty="${p.id}" data-d="1">+</button>
        </div>
      </div>
      <button class="ci-remove" data-remove="${p.id}" title="Remove">🗑️</button>
    </div>`;
  }).join('');

  const t = getCartTotals();
  foot.innerHTML = `
    <div class="sum-row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="sum-row"><span>Delivery ${t.delivery===0?'<span class="tag green">FREE</span>':''}</span><span>${money(t.delivery)}</span></div>
    <div class="sum-row"><span>Platform fee (2%)</span><span>${money(t.platform)}</span></div>
    <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>
    <button class="btn btn-primary btn-block" style="margin-top:1rem" id="checkoutBtn">Proceed to Checkout →</button>
  `;
  updateBadges();
}

function renderWishlistUI() {
  const body = $('#wishBody');
  if (!body) return;
  if (wishlistItems.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="big">🤍</div><h3>Wishlist is empty</h3><p>Tap the heart icon on any product to save it here.</p></div>`;
    return;
  }
  body.innerHTML = wishlistItems.map(id => {
    const p = getProduct(id);
    if (!p) return '';
    const f = farmerOf(p.farmerId);
    return `<div class="cart-item">
      <div class="ci-em">${p.emoji||'🌿'}</div>
      <div class="ci-info">
        <b>${p.name}</b>
        <small>${f.farm}</small>
        <span class="ci-price">${money(p.price)}/${p.unit}</span>
        <div class="qty" style="margin-top:.5rem">
          <button class="btn btn-primary btn-sm" data-add="${p.id}" style="border-radius:9px;padding:.35rem .7rem">Move to Cart</button>
        </div>
      </div>
      <button class="ci-remove" data-wish="${p.id}" title="Remove">✕</button>
    </div>`;
  }).join('');
}

function updateBadges() {
  const cartQty = cartItems.reduce((s,c) => s + c.qty, 0);
  const cc = $('#cartCount'), wc = $('#wishCount');
  if (cc) {
    cc.textContent = cartQty;
    cc.classList.toggle('hidden', cartQty === 0);
  }
  if (wc) {
    wc.textContent = wishlistItems.length;
    wc.classList.toggle('hidden', wishlistItems.length === 0);
  }
}

/* ---------------- PRODUCT MODAL & REVIEWS ---------------- */
async function openProductModal(id) {
  const p = getProduct(id);
  if (!p) return;
  const f = farmerOf(p.farmerId);
  state.activeProductId = id;
  state.tempRating = 0;

  const s = stockInfo(p);
  const reviews = await fetchReviews(p.name);
  const g = p.g || ['#eaf7ee','#cfeada'];

  const modalBody = $('#productModalBody');
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div class="pd-hero" style="background:linear-gradient(135deg,${g[0]},${g[1]})"><span>${p.emoji||'🌿'}</span></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem">
      <span class="tag green">${p.cat}</span>
      <span class="tag ${s.cls==='out'?'red':s.cls==='low'?'amber':'blue'}">${s.label}</span>
      ${f.verified?'<span class="tag green">✓ Verified Farmer</span>':''}
    </div>
    <h3 class="pd-title">${p.name}</h3>
    <p class="pd-sub">👨‍🌾 ${f.name} · ${f.farm} · ${f.location}</p>
    <div class="pd-price">${money(p.price)}<span> / ${p.unit}</span></div>
    <p class="pd-desc">${p.desc || 'Fresh harvest direct from local farm.'}</p>
    <div class="pd-facts">
      <div class="pd-fact"><b>${(p.rating||5).toFixed(1)}★</b><span>Rating</span></div>
      <div class="pd-fact"><b>${p.reviews||reviews.length}</b><span>Reviews</span></div>
      <div class="pd-fact"><b>${p.stock}</b><span>In Stock (${p.unit})</span></div>
    </div>
    <div style="display:flex;gap:.6rem;margin-bottom:1.6rem">
      <button class="btn btn-primary" style="flex:1" data-add="${p.id}" ${p.stock<=0?'disabled':''}>
        ${p.stock<=0?'Out of Stock':'🛒 Add to Cart'}
      </button>
      <button class="btn btn-outline" data-wish="${p.id}">${wishlistItems.includes(p.id)?'❤️ Saved':'🤍 Save'}</button>
    </div>

    <h4 style="font-size:.95rem;color:var(--g900);margin-bottom:.7rem">Rate this farm produce</h4>
    <div class="stars" id="starPick">
      ${[1,2,3,4,5].map(i => `<button data-star="${i}">★</button>`).join('')}
    </div>
    <div class="field" style="margin:.9rem 0">
      <textarea id="reviewText" rows="2" placeholder="Share your experience with this harvest…"></textarea>
    </div>
    <button class="btn btn-dark btn-sm" id="btnSubmitReview">Post Review to Firebase</button>

    <h4 style="font-size:.95rem;color:var(--g900);margin:1.6rem 0 .7rem">Customer Reviews (${reviews.length})</h4>
    <div id="productReviewList">
      ${reviews.length ? reviews.map(r => `
        <div class="review">
          <div class="rv-top"><b>${r.user}</b><span>${'★'.repeat(r.rating||5)}</span></div>
          <p>${r.text}</p>
        </div>`).join('') : '<p style="font-size:.85rem;color:var(--muted)">No reviews yet. Be the first to review!</p>'}
    </div>
  `;

  openModal('productModal');

  // Star picking
  modalBody.querySelectorAll('#starPick button').forEach(b => {
    b.addEventListener('click', () => {
      state.tempRating = Number(b.dataset.star);
      modalBody.querySelectorAll('#starPick button').forEach(x => x.classList.toggle('on', Number(x.dataset.star) <= state.tempRating));
    });
  });

  // Submit review
  $('#btnSubmitReview')?.addEventListener('click', async () => {
    const txt = $('#reviewText').value.trim();
    if (!state.tempRating) { toast('Rating required', 'Select a star rating first.', 'warn'); return; }
    if (txt.length < 4) { toast('Review text required', 'Please share a few words about the produce.', 'warn'); return; }

    const userName = currentUserProfile ? currentUserProfile.name : (currentUser ? currentUser.displayName : 'Guest User');
    await addReview({
      productId: p.id,
      productName: p.name,
      userName,
      rating: state.tempRating,
      text: txt
    });

    toast('Review submitted', 'Your feedback was saved in Firebase!');
    openProductModal(id);
  });
}

/* ---------------- AUTH MODAL & PROFILE UI ---------------- */
let authMode = 'login';
let selectedRole = 'consumer';

function openAuthModal(mode = 'login') {
  authMode = mode;
  const isReg = mode === 'register';

  $('#authTitle').textContent = isReg ? 'Create your account 🌱' : 'Welcome back 👋';
  $('#authSubmit').textContent = isReg ? 'Create Account' : 'Login Securely';
  $('#authName').parentElement.classList.toggle('hidden', !isReg);
  $('#rolePick').classList.toggle('hidden', !isReg);
  $('#locationField').classList.toggle('hidden', !(isReg && selectedRole === 'farmer'));

  // Clear inputs
  $('#authEmail').value = '';
  $('#authPass').value = '';
  if ($('#authName')) $('#authName').value = '';

  openModal('authModal');
}

function updateAuthUI() {
  const btn = $('#authBtn');
  const userActions = $('.nav-actions');

  // Remove existing dropdown if any
  const oldMenu = $('#userMenuWrap');
  if (oldMenu) oldMenu.remove();

  // Verification banner
  let verifyBanner = $('#verifyBanner');
  if (currentUser && !currentUser.emailVerified) {
    if (!verifyBanner) {
      verifyBanner = document.createElement('div');
      verifyBanner.id = 'verifyBanner';
      verifyBanner.className = 'verify-banner';
      verifyBanner.innerHTML = `
        <span>⚠️ Your email is not verified yet. Verify for full platform features.</span>
        <button id="btnResendVerify">Send Verification Link</button>
      `;
      document.body.prepend(verifyBanner);
      $('#btnResendVerify')?.addEventListener('click', async () => {
        try {
          await resendVerificationEmail();
          toast('Verification sent', 'Check your inbox for the link.');
        } catch (e) {
          toast('Notice', e.message, 'warn');
        }
      });
    }
  } else if (verifyBanner) {
    verifyBanner.remove();
  }

  if (currentUser && currentUserProfile) {
    btn.classList.add('hidden');

    const roleName = currentUserProfile.role || 'consumer';
    const initials = (currentUserProfile.name || currentUser.displayName || 'U').slice(0, 2).toUpperCase();

    const menuWrap = document.createElement('div');
    menuWrap.id = 'userMenuWrap';
    menuWrap.className = 'user-menu-wrap';
    menuWrap.innerHTML = `
      <button class="user-menu-btn" id="userMenuToggle">
        <span class="user-avatar-tag">${initials}</span>
        <span>${(currentUserProfile.name || 'User').split(' ')[0]}</span>
        <span style="font-size:.65rem">▾</span>
      </button>
      <div class="user-dropdown" id="userDropdown">
        <div class="user-dropdown-header">
          <b>${currentUserProfile.name || 'User'}</b>
          <small>${currentUser.email}</small>
          <span class="tag ${roleName==='admin'?'red':roleName==='farmer'?'green':'blue'}" style="margin-top:.3rem">${roleName.toUpperCase()}</span>
        </div>
        <a class="user-dropdown-item" href="#dashboard" id="menuItemDash">📊 Dashboard</a>
        <button class="user-dropdown-item" id="menuItemProfile">👤 Profile & Settings</button>
        <button class="user-dropdown-item danger" id="menuItemLogout">🚪 Logout</button>
      </div>
    `;

    userActions.insertBefore(menuWrap, $('#hamburger'));

    $('#userMenuToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#userDropdown').classList.toggle('show');
    });

    $('#menuItemProfile').addEventListener('click', () => {
      $('#userDropdown').classList.remove('show');
      openProfileModal();
    });

    $('#menuItemLogout').addEventListener('click', async () => {
      $('#userDropdown').classList.remove('show');
      if (confirm('Log out of Farm Fresh Web Portal?')) {
        await logoutUser();
        toast('Logged out', 'You have been signed out.');
      }
    });

    document.addEventListener('click', () => {
      $('#userDropdown')?.classList.remove('show');
    });

  } else {
    btn.classList.remove('hidden');
    btn.textContent = 'Login';
    btn.classList.add('btn-primary');
    btn.onclick = () => openAuthModal('login');
  }
}

function openProfileModal() {
  if (!currentUserProfile) return;
  alert(`User Profile:\nName: ${currentUserProfile.name}\nEmail: ${currentUser.email}\nRole: ${currentUserProfile.role.toUpperCase()}\nLocation: ${currentUserProfile.location || 'N/A'}\nUID: ${currentUser.uid}`);
}

/* ---------------- CHECKOUT & ORDER WORKFLOW ---------------- */
function openCheckoutModal() {
  if (cartItems.length === 0) {
    toast('Cart is empty', 'Add produce to cart before checking out.', 'warn');
    return;
  }
  if (!currentUser) {
    toast('Login required', 'Please login to complete your order.', 'warn');
    openAuthModal('login');
    return;
  }

  closeAll();
  const t = getCartTotals();
  $('#coTotal').textContent = money(t.total);
  if (currentUserProfile) {
    $('#coName').value = currentUserProfile.name || currentUser?.displayName || '';
    if (currentUserProfile.phone) $('#coPhone').value = currentUserProfile.phone;
    if (currentUserProfile.address) $('#coAddr').value = currentUserProfile.address;
  }

  $('#coSummary').innerHTML = `
    <div class="sum-row"><span>${cartItems.reduce((s,c)=>s+c.qty,0)} items</span><span>${money(t.sub)}</span></div>
    <div class="sum-row"><span>Delivery</span><span>${t.delivery===0?'FREE':money(t.delivery)}</span></div>
    <div class="sum-row"><span>Platform fee</span><span>${money(t.platform)}</span></div>
    <div class="sum-row total"><span>Payable</span><span>${money(t.total)}</span></div>
  `;

  setTimeout(() => openModal('checkoutModal'), 80);
}

async function handlePlaceOrder() {
  const name = $('#coName').value.trim();
  const phone = $('#coPhone').value.trim();
  const addr = $('#coAddr').value.trim();
  const pay = $('#coPay').value;

  if (name.length < 3) { toast('Validation error', 'Please enter delivery name.', 'err'); return; }
  if (!/^[6-9]\d{9}$/.test(phone)) { toast('Validation error', 'Enter valid 10-digit mobile number.', 'err'); return; }
  if (addr.length < 8) { toast('Validation error', 'Enter a complete delivery address.', 'err'); return; }

  const placeBtn = $('#placeOrderBtn');
  placeBtn.disabled = true;
  placeBtn.textContent = 'Processing Order…';

  try {
    const result = await placeOrder({
      items: cartItems,
      deliveryDetails: { name, phone, addr },
      payMethod: pay
    });

    closeAll();
    $('#orderReceipt').innerHTML = `
      <div class="sum-row"><span>Order ID</span><b>${result.id}</b></div>
      <div class="sum-row"><span>Amount</span><b>${money(result.total)}</b></div>
      <div class="sum-row"><span>Payment</span><b>${result.payMethod}</b></div>
      <div class="sum-row"><span>Customer</span><b>${result.name}</b></div>
      <div class="sum-row"><span>Status</span><span class="tag green">Confirmed</span></div>
    `;

    setTimeout(() => openModal('successModal'), 120);
    toast('Order Placed 🎉', `${result.id} · ${money(result.total)} via ${pay}`);
    renderProducts();
    renderDashboard();
  } catch (err) {
    toast('Order failed', err.message, 'err');
  } finally {
    placeBtn.disabled = false;
    placeBtn.innerHTML = `Place Order · <span id="coTotal">${money(getCartTotals().total)}</span>`;
  }
}

/* ---------------- EVENT DELEGATION ---------------- */
function setupGlobalEvents() {
  document.addEventListener('click', async (e) => {
    const t = e.target;

    // Wishlist button
    const wish = t.closest('[data-wish]');
    if (wish) {
      e.stopPropagation();
      const isAdded = await toggleWishlist(wish.dataset.wish);
      toast(isAdded ? 'Added to Wishlist' : 'Removed from Wishlist', getProduct(wish.dataset.wish)?.name || '', isAdded?'':'warn');
      renderProducts();
      renderWishlistUI();
      if ($('#productModal').classList.contains('show')) openProductModal(state.activeProductId);
      return;
    }

    // Add to cart button
    const add = t.closest('[data-add]');
    if (add) {
      e.stopPropagation();
      const res = await addToCart(add.dataset.add);
      if (res.success) {
        toast('Added to Cart 🛒', `${res.item.name} (${money(res.item.price)}/${res.item.unit})`);
        bumpBadge($('#cartCount'));
      } else if (res.reason === 'limit_reached') {
        toast('Stock limit reached', `Only ${res.max} available in stock.`, 'warn');
      } else {
        toast('Out of stock', 'This item is currently sold out.', 'warn');
      }
      if ($('#productModal').classList.contains('show')) closeAll();
      return;
    }

    // Qty change
    const q = t.closest('[data-qty]');
    if (q) {
      await updateCartQty(q.dataset.qty, Number(q.dataset.d));
      return;
    }

    // Remove from cart
    const rem = t.closest('[data-remove]');
    if (rem) {
      await removeFromCart(rem.dataset.remove);
      toast('Removed', 'Item removed from your cart.', 'warn');
      return;
    }

    // Category chips
    const chip = t.closest('[data-cat]');
    if (chip) {
      state.filters.cat = chip.dataset.cat;
      renderChips();
      renderProducts();
      return;
    }

    // Product card click opens detail modal
    const card = t.closest('.product-card');
    if (card && !t.closest('button')) {
      openProductModal(card.dataset.id);
      return;
    }
  });

  // Modal / drawer close triggers
  $('#overlay').addEventListener('click', closeAll);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeAll();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // Nav actions
  $('#cartBtn').addEventListener('click', () => openDrawer('cartDrawer'));
  $('#wishBtn').addEventListener('click', () => openDrawer('wishDrawer'));
  $('#dashLoginBtn').addEventListener('click', () => openAuthModal('login'));
  $('#heroSellBtn').addEventListener('click', () => {
    selectedRole = 'farmer';
    $$('.role-opt').forEach(b => b.classList.toggle('active', b.dataset.role === 'farmer'));
    openAuthModal('register');
  });

  // Checkout trigger
  document.addEventListener('click', e => {
    if (e.target.id === 'checkoutBtn') openCheckoutModal();
  });
  $('#placeOrderBtn')?.addEventListener('click', handlePlaceOrder);

  // Search and filter inputs
  $('#searchInput')?.addEventListener('input', e => { state.filters.search = e.target.value; renderProducts(); });
  $('#sortSelect')?.addEventListener('change', e => { state.filters.sort = e.target.value; renderProducts(); });
  $('#priceSelect')?.addEventListener('change', e => { state.filters.maxPrice = Number(e.target.value); renderProducts(); });
  $('#locSelect')?.addEventListener('change', e => { state.filters.loc = e.target.value; renderProducts(); });
  $('#availToggle')?.addEventListener('change', e => { state.filters.inStockOnly = e.target.checked; renderProducts(); });

  // Role picker in auth modal
  $('#rolePick')?.addEventListener('click', e => {
    const btn = e.target.closest('.role-opt');
    if (!btn) return;
    $$('.role-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;
    $('#locationField').classList.toggle('hidden', selectedRole !== 'farmer');
  });

  // Auth submit
  $('#authSubmit')?.addEventListener('click', async () => {
    const isReg = authMode === 'register';
    const email = $('#authEmail').value.trim();
    const pass = $('#authPass').value;
    const name = isReg ? $('#authName').value.trim() : '';
    const loc = $('#authLocation').value.trim();

    if (isReg && name.length < 2) { toast('Validation error', 'Please enter your full name.', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Validation error', 'Enter a valid email address.', 'err'); return; }
    if (pass.length < 6) { toast('Validation error', 'Password must be at least 6 characters.', 'err'); return; }

    const submitBtn = $('#authSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating…';

    try {
      if (isReg) {
        await registerUser({
          name,
          email,
          password: pass,
          role: selectedRole,
          location: loc
        });
        toast('Account created 🎉', `Welcome to Farm Fresh, ${name}!`);
      } else {
        await loginUser(email, pass);
        toast('Welcome back 👋', `Signed in as ${currentUserProfile?.name || email}`);
      }
      closeAll();
      renderDashboard();
    } catch (err) {
      console.error(err);
      let userMsg = err.message;
      if (err.code === 'auth/email-already-in-use') userMsg = 'Email is already registered. Please login instead.';
      else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') userMsg = 'Invalid email or password.';
      else if (err.code === 'auth/weak-password') userMsg = 'Password must be at least 6 characters.';
      toast('Authentication error', userMsg, 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isReg ? 'Create Account' : 'Login Securely';
    }
  });

  // Forgot password trigger in auth modal
  const demoNote = $('.demo-note');
  if (demoNote) {
    demoNote.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
        <span>🔒 <b>Secure Firebase Auth:</b> Passwords hashed via Firebase Authentication.</span>
        <button id="btnForgotPassword" style="color:var(--g600);font-weight:700;font-size:.76rem;text-decoration:underline">Forgot Password?</button>
      </div>
      <div class="auth-switch" style="margin-top:.6rem">
        <span id="authSwitchPrompt">Don't have an account? </span>
        <button id="btnToggleAuthMode">${authMode==='login'?'Create one':'Login instead'}</button>
      </div>
    `;

    $('#btnForgotPassword')?.addEventListener('click', async () => {
      const email = $('#authEmail').value.trim();
      if (!email) {
        toast('Email required', 'Enter your email address in the field above first.', 'warn');
        return;
      }
      try {
        await requestPasswordReset(email);
        toast('Reset email sent', `Password reset instructions sent to ${email}.`);
      } catch (err) {
        toast('Error', err.message, 'err');
      }
    });

    $('#btnToggleAuthMode')?.addEventListener('click', () => {
      openAuthModal(authMode === 'login' ? 'register' : 'login');
      $('#btnToggleAuthMode').textContent = authMode === 'login' ? 'Create one' : 'Login instead';
      $('#authSwitchPrompt').textContent = authMode === 'login' ? "Don't have an account? " : "Already have an account? ";
    });
  }

  // Navbar scroll styling
  window.addEventListener('scroll', () => {
    $('#nav').classList.toggle('scrolled', window.scrollY > 24);
  });

  // Hamburger mobile menu
  $('#hamburger')?.addEventListener('click', () => {
    $('#navLinks').classList.toggle('open');
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => {
    $$('#navLinks a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    $('#navLinks').classList.remove('open');
  }));

  // Scroll reveal
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(el => io.observe(el));
}

/* ---------------- APPLICATION BOOTSTRAP ---------------- */
export async function bootApp() {
  console.log("Booting Farm Fresh Web Portal with Firebase Backend...");

  // Subscribe to reactive data streams
  subscribeCart(() => {
    renderCartUI();
    renderWishlistUI();
    renderProducts();
  });

  subscribeAuth(async (user, profile) => {
    updateAuthUI();
    await loadCartAndWishlist(user);
    renderDashboard();
  });

  // Setup DOM events
  setupGlobalEvents();

  // Load database and seed if empty
  await seedDatabaseIfEmpty();
  await Promise.all([fetchFarmers(), fetchProducts()]);

  // Initial renders
  renderChips();
  renderProducts();
  renderFarmers();
  renderHeroRows();
  renderRecommendations();
  renderCartUI();
  renderWishlistUI();
  updateBadges();

  // Start Auth State Listener
  initAuthListener();

  // Welcome toast
  setTimeout(() => {
    toast('Farm Fresh Live 🌿', 'Connected directly to Google Firebase backend.');
  }, 750);
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
