import {
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase-config.js";
import { currentUser } from "./auth.js";
import { cachedProducts } from "./database.js";

export let cartItems = [];
export let wishlistItems = [];

// Storage keys for guest fallback
const GUEST_CART_KEY = "farmfresh_guest_cart";
const GUEST_WISH_KEY = "farmfresh_guest_wish";

// Listeners
const cartSubscribers = [];
export function subscribeCart(callback) {
  cartSubscribers.push(callback);
}
function notifyCart() {
  cartSubscribers.forEach(cb => {
    try { cb(cartItems, wishlistItems); } catch (e) { console.error(e); }
  });
}

// Helper to find product from cache
export function getProduct(id) {
  return cachedProducts.find(p => p.id === id);
}

// Calculate totals
export function getCartTotals() {
  let sub = 0;
  cartItems.forEach(line => {
    const p = getProduct(line.id);
    if (p) sub += p.price * line.qty;
  });
  const delivery = sub > 500 || sub === 0 ? 0 : 40;
  const platform = sub === 0 ? 0 : Math.round(sub * 0.02);
  return {
    sub,
    delivery,
    platform,
    total: sub + delivery + platform
  };
}

// Load cart and wishlist from Firestore (or localStorage for guests)
export async function loadCartAndWishlist(user) {
  if (user) {
    try {
      // Load from Firestore
      const cartSnap = await getDoc(doc(db, "carts", user.uid));
      let cloudCart = cartSnap.exists() ? cartSnap.data().items || [] : [];

      const wishSnap = await getDoc(doc(db, "wishlists", user.uid));
      let cloudWish = wishSnap.exists() ? wishSnap.data().items || [] : [];

      // Merge with any guest items that were accumulated before logging in
      const guestCart = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
      const guestWish = JSON.parse(localStorage.getItem(GUEST_WISH_KEY) || "[]");

      if (guestCart.length) {
        guestCart.forEach(g => {
          const match = cloudCart.find(c => c.id === g.id);
          if (match) match.qty += g.qty;
          else cloudCart.push(g);
        });
        localStorage.removeItem(GUEST_CART_KEY);
        await saveCartToFirestore(user.uid, cloudCart);
      }

      if (guestWish.length) {
        guestWish.forEach(w => {
          if (!cloudWish.includes(w)) cloudWish.push(w);
        });
        localStorage.removeItem(GUEST_WISH_KEY);
        await saveWishlistToFirestore(user.uid, cloudWish);
      }

      cartItems = cloudCart;
      wishlistItems = cloudWish;
    } catch (err) {
      console.warn("Error loading Firestore cart:", err.message);
      loadGuestCart();
    }
  } else {
    loadGuestCart();
  }
  notifyCart();
}

function loadGuestCart() {
  try {
    cartItems = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
    wishlistItems = JSON.parse(localStorage.getItem(GUEST_WISH_KEY) || "[]");
  } catch (e) {
    cartItems = [];
    wishlistItems = [];
  }
}

// Persist cart
async function persistCart() {
  if (currentUser) {
    await saveCartToFirestore(currentUser.uid, cartItems);
  } else {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
  }
  notifyCart();
}

// Persist wishlist
async function persistWishlist() {
  if (currentUser) {
    await saveWishlistToFirestore(currentUser.uid, wishlistItems);
  } else {
    localStorage.setItem(GUEST_WISH_KEY, JSON.stringify(wishlistItems));
  }
  notifyCart();
}

async function saveCartToFirestore(uid, items) {
  try {
    await setDoc(doc(db, "carts", uid), {
      items,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore cart sync error:", e.message);
  }
}

async function saveWishlistToFirestore(uid, items) {
  try {
    await setDoc(doc(db, "wishlists", uid), {
      items,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore wishlist sync error:", e.message);
  }
}

// Add to cart with inventory limit check
export async function addToCart(id) {
  const p = getProduct(id);
  if (!p || p.stock <= 0) return { success: false, reason: "out_of_stock" };

  const line = cartItems.find(c => c.id === id);
  if (line) {
    if (line.qty >= p.stock) {
      return { success: false, reason: "limit_reached", max: p.stock };
    }
    line.qty++;
  } else {
    cartItems.push({ id, qty: 1 });
  }

  await persistCart();
  return { success: true, item: p };
}

// Update quantity
export async function updateCartQty(id, delta) {
  const line = cartItems.find(c => c.id === id);
  if (!line) return;
  const p = getProduct(id);

  line.qty += delta;
  if (line.qty <= 0) {
    cartItems = cartItems.filter(c => c.id !== id);
  } else if (p && line.qty > p.stock) {
    line.qty = p.stock;
  }
  await persistCart();
}

// Remove from cart
export async function removeFromCart(id) {
  cartItems = cartItems.filter(c => c.id !== id);
  await persistCart();
}

// Clear cart (e.g. after successful order)
export async function clearCart() {
  cartItems = [];
  await persistCart();
}

// Toggle wishlist
export async function toggleWishlist(id) {
  const index = wishlistItems.indexOf(id);
  let isAdded = false;
  if (index > -1) {
    wishlistItems.splice(index, 1);
  } else {
    wishlistItems.push(id);
    isAdded = true;
  }
  await persistWishlist();
  return isAdded;
}
