# ⚙️ Farm Fresh — Backend Architecture & Configuration

This directory manages the backend configurations, serverless environment variables, and authentication settings for the Farm Fresh platform.

---

## 📁 Files
- **`.env.example`**: Public web environment configuration template with Firebase project references.
- **`README.md`**: Backend instructions and guidelines for Cloud Functions or external API integrations.

---

## 🔐 Backend Services Configured
1. **Firebase Authentication (v10.12.0 Modular SDK)**:
   - Email / Password authentication provider.
   - Session state persistence via `onAuthStateChanged`.
   - Client and server-side RBAC role allocation (Consumer, Farmer, Administrator).

2. **Cloud Firestore Real-Time Database**:
   - Server-side atomic transactions for order checkout and stock decrement.
   - Protected security rules located in `../database/firestore.rules`.

3. **Firebase Hosting**:
   - Production CDN distribution serving the client application directly from `../frontend/`.
