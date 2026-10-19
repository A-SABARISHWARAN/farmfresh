# 🌿 Farm Fresh Web Portal — Full-Stack Firebase Production App

A modern, full-stack agricultural marketplace connecting local farmers directly with consumers — cutting out middlemen, guaranteeing transparency, and delivering harvest produce at peak freshness.

**Live Deployed Web Application:** [https://farmfresh-portal-2026.web.app](https://farmfresh-portal-2026.web.app)

---

## 🚀 Key Features Implemented

1. **Production Firebase Authentication**:
   - Real email & password registration with email verification and password reset support.
   - User session persistence across browser refreshes and multiple devices via `onAuthStateChanged`.
   - Security-enforced role allocation (Consumers and Farmers register through public portal; Administrators are granted privileges only via protected configuration and Firestore security checks).

2. **Cloud Firestore Real-Time Database**:
   - `users`: User profiles linked by Firebase Auth UID.
   - `farmers`: Verified farm directory with locations, ratings, and admin verification status.
   - `products`: Complete marketplace inventory with prices, categories, emojis, and live stock tracking.
   - `orders`: Atomic transactions ensuring stock is verified and decremented safely during checkout.
   - `carts`: Persistent cross-device cart synchronized with Cloud Firestore, featuring guest cart auto-merging.
   - `wishlists`: Cloud-saved personal wishlist for authenticated shoppers.
   - `reviews`: Product reviews linked to authentic consumer purchases with dynamic rating calculation.
   - `complaints`: Consumer issue ticketing desk resolved directly by platform administrators.

3. **Role-Based Access Control (RBAC)**:
   - **Consumer Workspace**: Personal order history with live delivery tracking steps (Placed → Confirmed → Packed → Shipped → Delivered), wishlist items, customer reviews, and complaint desk.
   - **Farmer Workspace**: Harvest inventory overview, Add Product tool with instant validation, restock utilities (+50 units), and fulfillment view of customer orders containing the farmer's produce.
   - **Admin Workspace**: Platform KPIs (Gross GMV, registered users, active listings, open issues), farmer verification review (Approve / Revoke), product moderation, order fulfillment progression, and complaint resolution.

4. **Production Security Rules (`firestore.rules`)**:
   - Strict least-privilege security policies.
   - Unauthorized role escalation blocked at database level.
   - Only authenticated consumers can access their private cart, wishlist, and orders.
   - Farmer profile verification flag can only be updated by verified Administrators.

---

## 📂 Organized Project Architecture

```
e:\Farmfresh\
├── frontend\                  # 🌐 Client Web Application (HTML / CSS / JS)
│   ├── index.html             # Main application portal with semantic HTML5 & accessibility
│   ├── css\
│   │   └── styles.css         # Agricultural palette, glassmorphism, responsive styles
│   └── js\
│       ├── firebase-config.js # Firebase Modular SDK initialization (v10.12.0)
│       ├── auth.js            # Authentication, session observer, and profile synchronization
│       ├── database.js        # Firestore CRUD, catalog seeder, reviews & complaints
│       ├── cart.js            # Persistent cart & wishlist with guest auto-merge
│       ├── orders.js          # Atomic inventory checkout transactions & order workflow
│       ├── dashboard.js       # Dynamic workspaces & Profile Details management
│       └── app.js             # Application controller, UI event delegation, filters
├── database\                  # 🗄️ Cloud Firestore Database Definitions
│   ├── firestore.rules        # Production RBAC security rules (deployed to Cloud Firestore)
│   ├── firestore.indexes.json # Compound query indexes for sorting & filtering
│   └── schema.md              # Documentation of collections, schemas, and security
├── backend\                   # ⚙️ Backend Services & Environment Configuration
│   ├── .env.example           # Environment template with public Firebase credentials
│   └── README.md              # Backend documentation and cloud service references
├── firebase.json              # Firebase Hosting (pointing to frontend/) & Firestore config
├── .firebaserc                # Active project binding (farmfresh-portal-2026)
├── index.html                 # Root redirect utility for local servers
└── README.md                  # Comprehensive project documentation
```

---

## 🛠️ Testing the Application End-to-End

### 1. Consumer Workflow
1. Navigate to [https://farmfresh-portal-2026.web.app](https://farmfresh-portal-2026.web.app) or run locally.
2. Click **Login** → select **Create one** → choose **Consumer** role.
3. Enter Full Name, Email, and Password (min. 6 characters) and click **Create Account**.
4. Browse products, filter by category or price, search for "Tomatoes" or "Milk".
5. Add items to cart. Observe cart badge incrementing.
6. Open Cart drawer → click **Proceed to Checkout**.
7. Enter delivery address, select Cash on Delivery or UPI, and click **Place Order**.
8. Verify order success modal with order receipt. Check that product stock decremented on the marketplace!
9. Open **Dashboard** to view live order tracking progress.

### 2. Farmer Workflow
1. Click **Sell as a Farmer** or register with the **Farmer** role.
2. Enter your Farm Location (e.g., *Coimbatore, TN*).
3. Access your **Farmer Dashboard** workspace.
4. Go to **Add Product** tab: fill in name, price, stock, category, and description. Click **Publish to Marketplace**.
5. Observe the new produce appearing in the live marketplace!

### 3. Administrator Workflow
1. Sign in with the designated administrator account: `sabarishsrinivas15@gmail.com` or `admin@farmfresh.com`.
2. Access the **Administrator Workspace** on the Dashboard.
3. View the platform overview, pending farmer verification requests, live orders, and open customer complaints.
4. Click **✓ Approve** on any pending farmer to grant them the verified badge on the marketplace.
5. Click **Advance Status →** on orders to move fulfillment from Confirmed → Packed → Shipped → Delivered.

---

## 🌐 Deployment to Firebase Hosting

To deploy any future updates to Firebase Hosting:

```bash
# Deploy hosting and firestore security rules
npx -y firebase-tools deploy
```

Live website: **[https://farmfresh-portal-2026.web.app](https://farmfresh-portal-2026.web.app)**
