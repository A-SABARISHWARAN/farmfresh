import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "./firebase-config.js";

// Designated administrator emails
export const ADMIN_EMAILS = [
  "sabarishsrinivas15@gmail.com",
  "admin@farmfresh.com"
];

export let currentUser = null;
export let currentUserProfile = null;

// Listeners for auth state changes
const authSubscribers = [];
export function subscribeAuth(callback) {
  authSubscribers.push(callback);
  if (currentUser) {
    callback(currentUser, currentUserProfile);
  }
}

function notifySubscribers() {
  authSubscribers.forEach(cb => {
    try {
      cb(currentUser, currentUserProfile);
    } catch (err) {
      console.error("Auth subscriber error:", err);
    }
  });
}

// User registration
export async function registerUser({ name, email, password, role, location, farmName, bio }) {
  // CRITICAL SECURITY ENFORCEMENT: Never allow public registration to create an Admin account
  let safeRole = role === "farmer" ? "farmer" : "consumer";
  if (ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
    safeRole = "admin";
  }

  // Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Update display name in Firebase Auth
  await updateProfile(user, { displayName: name.trim() });

  // Optional: Send email verification
  try {
    await sendEmailVerification(user);
  } catch (err) {
    console.warn("Could not send verification email immediately:", err.message);
  }

  // Create Firestore profile document under users/{uid}
  const userProfile = {
    uid: user.uid,
    name: name.trim(),
    email: user.email.toLowerCase(),
    role: safeRole,
    location: location?.trim() || "Coimbatore, TN",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, "users", user.uid), userProfile);

  // If registering as a farmer, also create a record in farmers/{uid}
  if (safeRole === "farmer") {
    const farmerRecord = {
      id: user.uid,
      ownerUid: user.uid,
      name: name.trim(),
      farm: farmName?.trim() || `${name.trim()}'s Organic Farm`,
      location: location?.trim() || "Coimbatore, TN",
      rating: 5.0,
      verified: false, // Farmers start unverified until admin review!
      avatar: "👨‍🌾",
      since: new Date().getFullYear(),
      bio: bio?.trim() || "Dedicated local farmer producing pesticide-free crops for community tables.",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "farmers", user.uid), farmerRecord);
  }

  currentUser = user;
  currentUserProfile = userProfile;
  notifySubscribers();
  return { user, profile: userProfile };
}

// User login
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;
  const profile = await fetchUserProfile(user);
  currentUser = user;
  currentUserProfile = profile;
  notifySubscribers();
  return { user, profile };
}

// User logout
export async function logoutUser() {
  await signOut(auth);
  currentUser = null;
  currentUserProfile = null;
  notifySubscribers();
}

// Password reset
export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

// Send verification email
export async function resendVerificationEmail() {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

// Fetch user profile from Firestore or create default if missing
export async function fetchUserProfile(user) {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data();
    // Auto-promote designated admin emails if not already marked
    if (ADMIN_EMAILS.includes(user.email.toLowerCase()) && data.role !== "admin") {
      data.role = "admin";
      await updateDoc(userRef, { role: "admin", updatedAt: serverTimestamp() });
    }
    if (data.role === "farmer") {
      try {
        const farmerSnap = await getDoc(doc(db, "farmers", user.uid));
        if (farmerSnap.exists()) {
          const fData = farmerSnap.data();
          data.farm = fData.farm || data.farm;
          data.bio = fData.bio || data.bio;
          data.since = fData.since || data.since;
          data.location = fData.location || data.location;
          data.phone = fData.phone || data.phone;
          data.verified = fData.verified ?? false;
        }
      } catch (e) {
        console.warn("Could not fetch farmer supplemental profile:", e);
      }
    }
    return data;
  }

  // Fallback profile creation if signed up via external provider or pre-existing auth user
  const isTargetAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
  const fallbackProfile = {
    uid: user.uid,
    name: user.displayName || user.email.split("@")[0],
    email: user.email.toLowerCase(),
    role: isTargetAdmin ? "admin" : "consumer",
    location: "Coimbatore, TN",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(userRef, fallbackProfile);
  return fallbackProfile;
}

// Update profile details
export async function updateUserProfile(updates) {
  if (!currentUser) throw new Error("No authenticated user.");
  const userRef = doc(db, "users", currentUser.uid);

  // Prevent users from changing their own role or UID
  const safeUpdates = { ...updates };
  delete safeUpdates.role;
  delete safeUpdates.uid;
  safeUpdates.updatedAt = serverTimestamp();

  // Save/merge user details into Firestore users/{uid}
  await setDoc(userRef, safeUpdates, { merge: true });

  // Update Auth display name if changed
  if (safeUpdates.name && safeUpdates.name !== currentUser.displayName) {
    try {
      await updateProfile(currentUser, { displayName: safeUpdates.name });
    } catch (e) {
      console.warn("Could not sync auth displayName:", e);
    }
  }

  // If user is a farmer, also sync farm details to farmers/{uid}
  if (currentUserProfile && currentUserProfile.role === "farmer") {
    try {
      const farmerRef = doc(db, "farmers", currentUser.uid);
      const farmerUpdates = {
        name: safeUpdates.name || currentUserProfile.name,
        farm: safeUpdates.farm || currentUserProfile.farm || `${safeUpdates.name || currentUserProfile.name}'s Farm`,
        location: safeUpdates.location || currentUserProfile.location || "Coimbatore, TN",
        phone: safeUpdates.phone || currentUserProfile.phone || "",
        bio: safeUpdates.bio || currentUserProfile.bio || "",
        updatedAt: serverTimestamp()
      };
      if (safeUpdates.since) farmerUpdates.since = Number(safeUpdates.since);
      await setDoc(farmerRef, farmerUpdates, { merge: true });
    } catch (err) {
      console.warn("Farmer collection sync warning:", err);
    }
  }

  currentUserProfile = { ...currentUserProfile, ...safeUpdates };
  notifySubscribers();
  return currentUserProfile;
}

// Initialize session state listener
export function initAuthListener(onStateLoaded) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      try {
        currentUserProfile = await fetchUserProfile(user);
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    } else {
      currentUser = null;
      currentUserProfile = null;
    }
    notifySubscribers();
    if (onStateLoaded) onStateLoaded(currentUser, currentUserProfile);
  });
}
