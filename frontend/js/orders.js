import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
} from "./firebase-config.js";
import { currentUser } from "./auth.js";
import { clearCart, getCartTotals } from "./cart.js";
import { cachedProducts } from "./database.js";

// Status definitions
export const ORDER_STATUSES = ["Placed", "Confirmed", "Packed", "Shipped", "Delivered"];

// Place an order with atomic stock deduction
export async function placeOrder({ items, deliveryDetails, payMethod }) {
  if (!currentUser) throw new Error("Authentication required to place an order.");
  if (!items || !items.length) throw new Error("Cart is empty.");

  const totals = getCartTotals();
  const orderId = "FF" + Math.floor(100000 + Math.random() * 900000);
  const orderRef = doc(db, "orders", orderId);

  // Execute atomic transaction: verifies stock and creates order
  await runTransaction(db, async (transaction) => {
    // 1. Read all product docs
    const productReads = [];
    for (const line of items) {
      const pRef = doc(db, "products", line.id);
      productReads.push({ ref: pRef, line, snap: await transaction.get(pRef) });
    }

    // 2. Validate stock availability
    for (const item of productReads) {
      if (!item.snap.exists()) {
        throw new Error(`Product ${item.line.name || item.line.id} no longer exists.`);
      }
      const liveStock = item.snap.data().stock || 0;
      if (liveStock < item.line.qty) {
        throw new Error(`Insufficient stock for ${item.snap.data().name}. Only ${liveStock} available.`);
      }
    }

    // 3. Decrement inventory
    for (const item of productReads) {
      const currentStock = item.snap.data().stock || 0;
      const newStock = Math.max(0, currentStock - item.line.qty);
      transaction.update(item.ref, { 
        stock: newStock,
        updatedAt: serverTimestamp() 
      });
      // Update local memory cache
      const cached = cachedProducts.find(p => p.id === item.line.id);
      if (cached) cached.stock = newStock;
    }

    // 4. Create snapshot line items and distinct farmer IDs
    const lineItemSnapshots = items.map(line => {
      const p = cachedProducts.find(x => x.id === line.id) || line;
      return {
        id: line.id,
        name: p.name,
        emoji: p.emoji,
        price: p.price,
        unit: p.unit,
        qty: line.qty,
        farmerId: p.farmerId
      };
    });

    const farmerIds = [...new Set(lineItemSnapshots.map(i => i.farmerId).filter(Boolean))];

    // 5. Commit order
    const orderData = {
      id: orderId,
      consumerUid: currentUser.uid,
      consumerEmail: currentUser.email,
      name: deliveryDetails.name.trim(),
      phone: deliveryDetails.phone.trim(),
      addr: deliveryDetails.addr.trim(),
      pay: payMethod,
      payStatus: payMethod === "COD" ? "Pending on Delivery" : "Paid",
      items: lineItemSnapshots,
      farmerIds,
      subtotal: totals.sub,
      delivery: totals.delivery,
      platform: totals.platform,
      total: totals.total,
      status: 1, // 1 = Confirmed
      date: new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(orderRef, orderData);
  });

  // Clear cart after successful transaction
  await clearCart();

  // Seamlessly save delivery contact & address to user profile in Firebase
  try {
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        phone: deliveryDetails.phone.trim(),
        address: deliveryDetails.addr.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (e) {
    console.warn("Could not auto-save delivery address to profile:", e);
  }

  return { id: orderId, total: totals.total, payMethod, name: deliveryDetails.name };
}

// Fetch orders according to user role
export async function fetchOrders(role, uid, farmerId = null) {
  try {
    const ordersRef = collection(db, "orders");
    let snap;

    if (role === "admin") {
      snap = await getDocs(ordersRef);
    } else if (role === "farmer") {
      // Fetch all orders and filter by farmer's products/farmerId
      snap = await getDocs(ordersRef);
      const targetFarmerId = farmerId || uid;
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(o => o.farmerIds && (o.farmerIds.includes(targetFarmerId) || o.farmerIds.includes("f1")))
        .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } else {
      // Consumer queries their own orders
      const q = query(ordersRef, where("consumerUid", "==", uid));
      snap = await getDocs(q);
    }

    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (err) {
    console.warn("fetchOrders notice:", err.message);
    return [];
  }
}

// Advance status (Packed -> Shipped -> Delivered)
export async function advanceOrderStatus(orderId, nextStatus) {
  const orderRef = doc(db, "orders", orderId);
  await updateDoc(orderRef, {
    status: nextStatus,
    updatedAt: serverTimestamp()
  });
}
