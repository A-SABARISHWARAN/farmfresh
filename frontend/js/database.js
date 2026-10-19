import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment
} from "./firebase-config.js";

// INITIAL SEED DATA TO POPULATE FIRESTORE ON FIRST BOOT
const SEED_FARMERS = [
  { id:'f1', ownerUid:'system_f1', name:'Ravi Kumar', farm:'Ravi Organic Farms', location:'Coimbatore, TN', rating:4.8, verified:true, avatar:'👨‍🌾', since:2015,
    bio:'Third-generation organic vegetable grower using drip irrigation and zero pesticides.' },
  { id:'f2', ownerUid:'system_f2', name:'Lakshmi Devi', farm:'Green Valley Agro', location:'Erode, TN', rating:4.6, verified:true, avatar:'👩‍🌾', since:2018,
    bio:'Specialises in spices and root vegetables. Women-led cooperative of 22 farmers.' },
  { id:'f3', ownerUid:'system_f3', name:'Murugan S.', farm:'Sunrise Orchards', location:'Madurai, TN', rating:4.9, verified:true, avatar:'🧑‍🌾', since:2012,
    bio:'Tropical fruit orchard famous for Alphonso mangoes and Nendran bananas.' },
  { id:'f4', ownerUid:'system_f4', name:'Priya Nair', farm:'Hilltop Naturals', location:'Ooty, TN', rating:4.7, verified:true, avatar:'👩‍🌾', since:2019,
    bio:'Hill-grown apples, guava and pepper at 2,200m elevation. Cool-climate produce.' },
  { id:'f5', ownerUid:'system_f5', name:'Anand Raja', farm:'Anand Grain Collective', location:'Salem, TN', rating:4.5, verified:false, avatar:'👨‍🌾', since:2020,
    bio:'Millets, rice and pulses grown with traditional seed-saving methods.' },
  { id:'f6', ownerUid:'system_f6', name:'Kavitha M.', farm:'Meadow Dairy Farm', location:'Trichy, TN', rating:4.8, verified:true, avatar:'🐄', since:2016,
    bio:'Grass-fed A2 milk, butter and free-range eggs. Daily morning dispatch.' }
];

const SEED_PRODUCTS = [
  { id:'p1',  name:'Fresh Tomatoes',    cat:'Vegetables', price:32,  unit:'kg',     stock:120, farmerId:'f1', emoji:'🍅', rating:4.7, reviews:34, g:['#ffe6e0','#ffc9bb'],
    desc:'Vine-ripened country tomatoes, harvested this morning. Firm, juicy and perfect for curries, salads and chutneys.' },
  { id:'p2',  name:'Organic Spinach',   cat:'Vegetables', price:25,  unit:'bunch',  stock:60,  farmerId:'f1', emoji:'🥬', rating:4.8, reviews:28, g:['#e6f7ea','#c3e9d1'],
    desc:'Tender green spinach leaves grown without chemical pesticides. Rich in iron and folate.' },
  { id:'p3',  name:'Farm Carrots',      cat:'Vegetables', price:48,  unit:'kg',     stock:75,  farmerId:'f2', emoji:'🥕', rating:4.6, reviews:21, g:['#fff0dd','#ffd9a8'],
    desc:'Sweet, crunchy red carrots pulled fresh from loamy soil. Great for juices and halwa.' },
  { id:'p4',  name:'Green Chillies',    cat:'Vegetables', price:40,  unit:'kg',     stock:8,   farmerId:'f2', emoji:'🌶️', rating:4.5, reviews:17, g:['#e9f9e5','#c4efbd'],
    desc:'Medium-hot green chillies with a bright, clean heat. Picked at peak pungency.' },
  { id:'p5',  name:'Sweet Mangoes',     cat:'Fruits',     price:120, unit:'kg',     stock:90,  farmerId:'f3', emoji:'🥭', rating:4.9, reviews:56, g:['#fff3d6','#ffe08a'],
    desc:'Alphonso-variety mangoes, naturally ripened without carbide. Intensely sweet and fibreless.' },
  { id:'p6',  name:'Nendran Bananas',   cat:'Fruits',     price:55,  unit:'dozen',  stock:140, farmerId:'f3', emoji:'🍌', rating:4.7, reviews:41, g:['#fffbe0','#f8eda5'],
    desc:'Kerala-style Nendran bananas — thick, starchy and delicious steamed or fried.' },
  { id:'p7',  name:'Hill Apples',       cat:'Fruits',     price:180, unit:'kg',     stock:35,  farmerId:'f4', emoji:'🍎', rating:4.6, reviews:23, g:['#ffe8e8','#ffc9c9'],
    desc:'Crisp, tangy apples grown in the cool Nilgiri hills. Excellent shelf life.' },
  { id:'p8',  name:'Fresh Guava',       cat:'Fruits',     price:60,  unit:'kg',     stock:0,   farmerId:'f4', emoji:'🍐', rating:4.4, reviews:14, g:['#eaf9e2','#c9efb4'],
    desc:'Aromatic white-flesh guava, high in vitamin C. Sold out — restocking soon.' },
  { id:'p9',  name:'Basmati Rice',      cat:'Grains',     price:95,  unit:'kg',     stock:300, farmerId:'f5', emoji:'🍚', rating:4.6, reviews:38, g:['#f5f2ea','#e3ded0'],
    desc:'Long-grain aged basmati with a delicate aroma. Perfect for biryani and pulao.' },
  { id:'p10', name:'Whole Wheat',       cat:'Grains',     price:45,  unit:'kg',     stock:220, farmerId:'f5', emoji:'🌾', rating:4.5, reviews:29, g:['#fdf6e3','#f2e3b8'],
    desc:'Stone-ground whole wheat flour retaining bran and germ. Bakes a hearty chapati.' },
  { id:'p11', name:'Ragi Millets',      cat:'Grains',     price:60,  unit:'kg',     stock:110, farmerId:'f5', emoji:'🌾', rating:4.7, reviews:26, g:['#f3ebe0','#dcc9ae'],
    desc:'Iron-rich finger millet, a traditional superfood. Ideal for porridge and malt.' },
  { id:'p12', name:'A2 Cow Milk',       cat:'Dairy',      price:65,  unit:'litre',  stock:48,  farmerId:'f6', emoji:'🥛', rating:4.9, reviews:63, g:['#eef4fb','#d5e6f7'],
    desc:'Raw A2 milk from indigenous Kangayam cows, grass-fed and hormone-free. Delivered chilled.' },
  { id:'p13', name:'Farm Butter',       cat:'Dairy',      price:220, unit:'500g',   stock:18,  farmerId:'f6', emoji:'🧈', rating:4.8, reviews:31, g:['#fff8e1','#ffe9a8'],
    desc:'Hand-churned cultured butter with a nutty finish. No preservatives, no colourants.' },
  { id:'p14', name:'Free-range Eggs',   cat:'Dairy',      price:90,  unit:'dozen',  stock:64,  farmerId:'f6', emoji:'🥚', rating:4.7, reviews:44, g:['#fbf6ee','#eadfc8'],
    desc:'Eggs from pasture-raised hens with deep-orange yolks and stronger shells.' },
  { id:'p15', name:'Turmeric Powder',   cat:'Spices',     price:150, unit:'kg',     stock:85,  farmerId:'f2', emoji:'🟡', rating:4.8, reviews:37, g:['#fff6da','#ffe28a'],
    desc:'Single-origin Erode turmeric with 4.2% curcumin. Stone-milled for full aroma.' },
  { id:'p16', name:'Black Pepper',      cat:'Spices',     price:480, unit:'kg',     stock:22,  farmerId:'f4', emoji:'⚫', rating:4.9, reviews:19, g:['#eceff0','#cdd4d7'],
    desc:'Bold hill-grown Malabar pepper, sun-dried and hand-sorted. Sharp and citrusy.' },
  { id:'p17', name:'Toor Dal',          cat:'Pulses',     price:130, unit:'kg',     stock:160, farmerId:'f5', emoji:'🫘', rating:4.6, reviews:33, g:['#fff3dc','#f5dfae'],
    desc:'Polished toor dal with quick cooking time and rich, creamy texture.' },
  { id:'p18', name:'Green Gram',        cat:'Pulses',     price:110, unit:'kg',     stock:95,  farmerId:'f5', emoji:'🫛', rating:4.5, reviews:22, g:['#eef9e8','#d2f0bf'],
    desc:'Whole moong beans, high in protein. Sprouts beautifully in 24 hours.' }
];

const SEED_REVIEWS = [
  { id:'r1', product:'Fresh Tomatoes', user:'Ananya R.', rating:5, text:'Unbelievably fresh — still had the vine smell!', date:'2025-01-12' },
  { id:'r2', product:'A2 Cow Milk',    user:'Vikram S.',  rating:5, text:'Thick, creamy and delivered cold. Subscribed weekly.', date:'2025-01-14' },
  { id:'r3', product:'Hill Apples',    user:'Meera K.',   rating:4, text:'Crisp and tangy. A couple were bruised but taste was great.', date:'2025-01-15' }
];

const SEED_COMPLAINTS = [
  { id:'c1', user:'Ananya R.', subject:'Late delivery', status:'open', text:'Order arrived 3 hours past the slot.' },
  { id:'c2', user:'Vikram S.', subject:'Damaged packaging', status:'resolved', text:'Butter container was cracked. Refund issued.' }
];

// In-memory cache for ultra-fast UI rendering after Firestore sync
export let cachedFarmers = [];
export let cachedProducts = [];

// Seed Firestore if empty
export async function seedDatabaseIfEmpty() {
  try {
    const prodSnap = await getDocs(collection(db, "products"));
    if (prodSnap.empty) {
      console.log("Seeding Firestore with initial Farm Fresh catalog...");
      for (const farmer of SEED_FARMERS) {
        await setDoc(doc(db, "farmers", farmer.id), {
          ...farmer,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      for (const prod of SEED_PRODUCTS) {
        await setDoc(doc(db, "products", prod.id), {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      for (const rev of SEED_REVIEWS) {
        await setDoc(doc(db, "reviews", rev.id), {
          ...rev,
          createdAt: serverTimestamp()
        });
      }
      for (const cmp of SEED_COMPLAINTS) {
        await setDoc(doc(db, "complaints", cmp.id), {
          ...cmp,
          createdAt: serverTimestamp()
        });
      }
      console.log("Firestore catalog seeding completed successfully.");
    }
  } catch (err) {
    console.warn("Seed check notice:", err.message);
  }
}

// Fetch all farmers from Firestore
export async function fetchFarmers() {
  try {
    const snap = await getDocs(collection(db, "farmers"));
    if (!snap.empty) {
      cachedFarmers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      cachedFarmers = [...SEED_FARMERS];
    }
  } catch (err) {
    console.warn("Using local farmer cache due to error:", err.message);
    if (!cachedFarmers.length) cachedFarmers = [...SEED_FARMERS];
  }
  return cachedFarmers;
}

// Fetch all products from Firestore
export async function fetchProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) {
      cachedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      cachedProducts = [...SEED_PRODUCTS];
    }
  } catch (err) {
    console.warn("Using local product cache due to error:", err.message);
    if (!cachedProducts.length) cachedProducts = [...SEED_PRODUCTS];
  }
  return cachedProducts;
}

// Add product to Firestore
export async function addProduct(productData) {
  const newRef = doc(collection(db, "products"));
  const record = {
    ...productData,
    id: newRef.id,
    rating: 0,
    reviews: 0,
    g: productData.g || ['#eaf7ee', '#cfeada'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(newRef, record);
  cachedProducts.unshift(record);
  return record;
}

// Restock / update product stock in Firestore
export async function updateProductStock(productId, newStock) {
  const prodRef = doc(db, "products", productId);
  await updateDoc(prodRef, {
    stock: newStock,
    updatedAt: serverTimestamp()
  });
  const cached = cachedProducts.find(p => p.id === productId);
  if (cached) cached.stock = newStock;
}

// Delete product from Firestore
export async function deleteProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
  cachedProducts = cachedProducts.filter(p => p.id !== productId);
}

// Approve or revoke farmer verification in Firestore
export async function setFarmerVerification(farmerId, verified) {
  const farmerRef = doc(db, "farmers", farmerId);
  await updateDoc(farmerRef, {
    verified,
    updatedAt: serverTimestamp()
  });
  const cached = cachedFarmers.find(f => f.id === farmerId);
  if (cached) cached.verified = verified;
}

// Fetch reviews for a product or all reviews
export async function fetchReviews(productName = null) {
  try {
    const snap = await getDocs(collection(db, "reviews"));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (productName) {
      return all.filter(r => r.product === productName);
    }
    return all.length ? all : [...SEED_REVIEWS];
  } catch (err) {
    console.warn("fetchReviews error:", err.message);
    return productName ? SEED_REVIEWS.filter(r => r.product === productName) : [...SEED_REVIEWS];
  }
}

// Post product review
export async function addReview({ productId, productName, userName, rating, text }) {
  const newRef = doc(collection(db, "reviews"));
  const record = {
    id: newRef.id,
    product: productName,
    productId: productId || null,
    user: userName || "Anonymous",
    rating: Number(rating),
    text: text.trim(),
    date: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp()
  };
  await setDoc(newRef, record);

  // Increment review count and update rating in the product document
  if (productId) {
    try {
      const prodRef = doc(db, "products", productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const cur = prodSnap.data();
        const currentCount = cur.reviews || 0;
        const currentAvg = cur.rating || 5;
        const newCount = currentCount + 1;
        const newRating = Number(((currentAvg * currentCount + Number(rating)) / newCount).toFixed(1));
        await updateDoc(prodRef, {
          reviews: newCount,
          rating: newRating,
          updatedAt: serverTimestamp()
        });
        const cached = cachedProducts.find(p => p.id === productId);
        if (cached) {
          cached.reviews = newCount;
          cached.rating = newRating;
        }
      }
    } catch (e) {
      console.warn("Product review aggregation error:", e.message);
    }
  }
  return record;
}

// Delete review (Admin)
export async function deleteReview(reviewId) {
  await deleteDoc(doc(db, "reviews", reviewId));
}

// Fetch complaints
export async function fetchComplaints() {
  try {
    const snap = await getDocs(collection(db, "complaints"));
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn("fetchComplaints error:", err.message);
  }
  return [...SEED_COMPLAINTS];
}

// Post complaint
export async function addComplaint({ userId, userName, subject, text }) {
  const newRef = doc(collection(db, "complaints"));
  const record = {
    id: newRef.id,
    userId: userId || null,
    user: userName || "Anonymous",
    subject: subject.trim(),
    text: text.trim(),
    status: "open",
    createdAt: serverTimestamp()
  };
  await setDoc(newRef, record);
  return record;
}

// Resolve complaint (Admin)
export async function resolveComplaint(complaintId) {
  const ref = doc(db, "complaints", complaintId);
  await updateDoc(ref, {
    status: "resolved",
    updatedAt: serverTimestamp()
  });
}
