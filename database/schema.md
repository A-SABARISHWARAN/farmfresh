# 🗄️ Farm Fresh — Cloud Firestore Database Architecture

This directory contains the database schema specifications, compound indexes, and production security rules for Cloud Firestore.

---

## 📁 Files
- **`firestore.rules`**: Production Role-Based Access Control (RBAC) security rules enforcing permissions for consumers, farmers, and administrators.
- **`firestore.indexes.json`**: Compound index definitions for multi-field queries (e.g., sorting products by category, rating, and price).

---

## 📊 Collections Overview

| Collection | Document ID | Description | Security / RBAC |
|---|---|---|---|
| `users` | Auth `uid` | User profile details (name, email, role, phone, address, location). | Read: Authenticated. Update: Owner or Admin. |
| `farmers` | `farmerId` / `uid` | Farm profile directory (farm name, location, rating, bio, verification status). | Read: Public. Create/Update: Owner or Admin. |
| `products` | `productId` | Marketplace inventory (name, cat, price, unit, stock, emoji, rating, farmerId). | Read: Public. Create/Update: Authenticated. Delete: Owner or Admin. |
| `orders` | `orderId` (e.g. `FF123456`) | Customer orders with line items, delivery details, status, and atomic stock decrements. | Read: Customer, Admin, or involved Farmers. Create: Customer. Update: Admin/Farmers. |
| `carts` | Auth `uid` | Persistent shopping cart items. | Read/Write: Owner only. |
| `wishlists` | Auth `uid` | Saved wishlist product IDs. | Read/Write: Owner only. |
| `reviews` | `reviewId` | Customer ratings & reviews linked to marketplace produce. | Read: Public. Create: Authenticated. |
| `complaints`| `complaintId` | Customer support issue tickets. | Read: Customer or Admin. Create: Authenticated. Resolve: Admin only. |
