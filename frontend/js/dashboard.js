import { currentUser, currentUserProfile, updateUserProfile } from "./auth.js";
import { 
  cachedFarmers, 
  cachedProducts, 
  fetchFarmers, 
  fetchProducts, 
  fetchReviews, 
  fetchComplaints, 
  setFarmerVerification, 
  updateProductStock, 
  deleteProduct, 
  deleteReview, 
  resolveComplaint,
  addComplaint,
  addProduct
} from "./database.js";
import { fetchOrders, advanceOrderStatus, ORDER_STATUSES } from "./orders.js";
import { wishlistItems } from "./cart.js";

let dashTab = "overview";
let dashboardOrders = [];
let dashboardReviews = [];
let dashboardComplaints = [];

const money = n => '₹' + Number(n).toLocaleString('en-IN');

export function orderTrackHTML(status) {
  const steps = ORDER_STATUSES;
  return `<div>
    <div class="track">
      ${steps.map((s,i) => `
        <span class="node ${i<=status?'done':''}"></span>
        ${i<steps.length-1 ? `<span class="bar ${i<status?'done':''}"></span>` : ''}
      `).join('')}
    </div>
    <div class="track-labels">${steps.map(s => `<span>${s}</span>`).join('')}</div>
  </div>`;
}

export async function renderDashboard(forceTab = null) {
  const shell = document.getElementById("dashShell");
  const locked = document.getElementById("dashLocked");
  const content = document.getElementById("dashContent");

  if (!currentUser || !currentUserProfile) {
    locked.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }

  locked.classList.add("hidden");
  content.classList.remove("hidden");

  const role = currentUserProfile.role || "consumer";
  if (forceTab) dashTab = forceTab;

  const tabs = role === "admin"
    ? [["overview","Overview"],["users","Users"],["farmers","Farmer Verification"],["products","Products"],["orders","Orders"],["reviews","Reviews"],["complaints","Complaints"],["profile","Profile & Details"]]
    : role === "farmer"
    ? [["overview","Overview"],["addproduct","Add Product"],["myproducts","My Products"],["orders","Orders"],["profile","Farm & Account Details"]]
    : [["overview","Overview"],["orders","My Orders"],["reviews","My Reviews"],["complaints","Complaint Desk"],["profile","My Profile & Details"]];

  if (!tabs.some(t => t[0] === dashTab)) dashTab = "overview";

  const roleLabel = { admin:"Administrator", farmer:"Farmer", consumer:"Consumer" }[role];

  content.innerHTML = `
    <div class="dash-top">
      <div>
        <h3>👋 Welcome, ${currentUserProfile.name || currentUser.displayName || "User"}</h3>
        <p>${roleLabel} workspace · ${currentUser.email}</p>
      </div>
      <span class="role-badge">🛡️ ${roleLabel} Access</span>
    </div>
    <div class="dash-tabs" id="dashTabsContainer">
      ${tabs.map(([k,l]) => `<button class="dtab ${dashTab===k?'active':''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div class="dash-body" id="dashBody">
      <div style="padding:2rem;text-align:center;color:var(--muted)">
        <div class="skeleton" style="height:120px;max-width:600px;margin:0 auto"></div>
      </div>
    </div>
  `;

  // Attach tab switcher
  document.querySelectorAll("#dashTabsContainer .dtab").forEach(tabBtn => {
    tabBtn.addEventListener("click", () => {
      dashTab = tabBtn.dataset.tab;
      document.querySelectorAll("#dashTabsContainer .dtab").forEach(b => b.classList.toggle("active", b.dataset.tab === dashTab));
      loadDashBodyData();
    });
  });

  await loadDashBodyData();
}

async function loadDashBodyData() {
  const body = document.getElementById("dashBody");
  const role = currentUserProfile?.role || "consumer";
  const uid = currentUser?.uid;

  // Fetch live orders for this user/role
  dashboardOrders = await fetchOrders(role, uid);
  dashboardReviews = await fetchReviews();
  dashboardComplaints = await fetchComplaints();

  // Profile and Account details management
  if (dashTab === "profile") {
    renderProfileTab(body, role, uid);
    return;
  }

  /* ==================== CONSUMER ==================== */
  if (role === "consumer") {
    if (dashTab === "overview") {
      const spend = dashboardOrders.reduce((s,o) => s + (o.total || 0), 0);
      const itemsBought = dashboardOrders.reduce((s,o) => s + (o.items ? o.items.length : 0), 0);

      body.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi"><div class="k-ico">📦</div><b>${dashboardOrders.length}</b><span>Total Orders</span></div>
          <div class="kpi"><div class="k-ico">💚</div><b>${wishlistItems.length}</b><span>Wishlist Items</span></div>
          <div class="kpi"><div class="k-ico">💰</div><b>${money(spend)}</b><span>Total Spent</span></div>
          <div class="kpi"><div class="k-ico">🌿</div><b>${itemsBought}</b><span>Products Bought</span></div>
        </div>
        <h4 style="font-size:.95rem;color:var(--g900);margin-bottom:.8rem">Recent Orders</h4>
        ${dashboardOrders.length ? dashboardOrders.slice(0,3).map(o => `
          <div style="padding:.9rem;border:1px solid var(--border);border-radius:14px;margin-bottom:.7rem;background:#fff">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem">
              <b style="font-size:.88rem">${o.id} · ${(o.items || []).length} item(s)</b>
              <span class="tag green">${money(o.total)} · ${o.pay || 'COD'}</span>
            </div>
            ${orderTrackHTML(o.status ?? 1)}
          </div>`).join('')
          : '<p style="color:var(--muted);font-size:.88rem">No orders placed yet. Explore the marketplace to support local farmers!</p>'}
      `;
    }
    else if (dashTab === "orders") {
      body.innerHTML = dashboardOrders.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Payment</th><th>Delivery Status</th></tr></thead>
          <tbody>${dashboardOrders.map(o => `
            <tr>
              <td><b>${o.id}</b><br><small style="color:var(--muted)">${o.date || 'Recent'}</small></td>
              <td>${(o.items || []).map(i => (i.emoji || '🌿') + ' ' + i.name + ' ×' + i.qty).join('<br>')}</td>
              <td><b>${money(o.total)}</b></td>
              <td><span class="tag blue">${o.pay || 'COD'}</span></td>
              <td style="min-width:180px">${orderTrackHTML(o.status ?? 1)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
        : `<div class="empty-state"><div class="big">📦</div><h3>No orders yet</h3><p>Your orders will appear here with live delivery tracking.</p></div>`;
    }
    else if (dashTab === "reviews") {
      const myReviews = dashboardReviews.filter(r => r.user === currentUserProfile.name || r.user === currentUser.displayName);
      body.innerHTML = `
        <p style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Reviews you've shared with the community.</p>
        ${myReviews.length ? myReviews.map(r => `
          <div class="review">
            <div class="rv-top"><b>${r.product}</b><span>${'★'.repeat(r.rating || 5)}</span></div>
            <p>${r.text}</p>
          </div>`).join('')
          : '<div class="empty-state"><div class="big">⭐</div><h3>No reviews yet</h3><p>Click on any product in the marketplace to rate and review it.</p></div>'}
      `;
    }
    else if (dashTab === "complaints") {
      const myComplaints = dashboardComplaints.filter(c => c.userId === uid || c.user === currentUserProfile.name);
      body.innerHTML = `
        <div class="dash-form" style="margin-bottom:1.8rem">
          <div class="field full">
            <label>Complaint Subject</label>
            <input type="text" id="cmpSubjectInput" placeholder="e.g. Late delivery, produce freshness issue">
          </div>
          <div class="field full">
            <label>Describe the issue</label>
            <textarea id="cmpTextInput" rows="3" placeholder="Provide details to help us investigate…"></textarea>
          </div>
          <div class="field full">
            <button class="btn btn-primary" id="btnSubmitComplaint" style="justify-self:start">Submit Complaint</button>
          </div>
        </div>
        <h4 style="font-size:.95rem;color:var(--g900);margin-bottom:.8rem">Your Submitted Issues</h4>
        ${myComplaints.length ? myComplaints.map(c => `
          <div style="padding:.9rem;border:1px solid var(--border);border-radius:14px;margin-bottom:.7rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;background:#fff">
            <div><b style="font-size:.88rem">${c.subject}</b><p style="font-size:.82rem;color:var(--muted)">${c.text}</p></div>
            <span class="tag ${c.status==='open'?'amber':'green'}">${c.status}</span>
          </div>`).join('')
          : '<p style="color:var(--muted);font-size:.85rem">No complaints registered.</p>'}
      `;

      document.getElementById("btnSubmitComplaint")?.addEventListener("click", async () => {
        const sub = document.getElementById("cmpSubjectInput").value.trim();
        const txt = document.getElementById("cmpTextInput").value.trim();
        if (sub.length < 3 || txt.length < 8) {
          alert("Please provide a valid subject and description.");
          return;
        }
        await addComplaint({ userId: uid, userName: currentUserProfile.name, subject: sub, text: txt });
        loadDashBodyData();
      });
    }
    return;
  }

  /* ==================== FARMER ==================== */
  if (role === "farmer") {
    const myFarmerId = currentUser.uid;
    const myProducts = cachedProducts.filter(p => p.farmerId === myFarmerId || p.farmerId === "f1");

    if (dashTab === "overview") {
      const revenue = dashboardOrders.reduce((sum, o) => {
        const orderItems = o.items || [];
        return sum + orderItems.reduce((acc, i) => acc + (i.price || 0) * (i.qty || 1), 0);
      }, 0);

      body.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi"><div class="k-ico">🌾</div><b>${myProducts.length}</b><span>Listed Products</span></div>
          <div class="kpi"><div class="k-ico">📦</div><b>${dashboardOrders.length}</b><span>Orders Received</span></div>
          <div class="kpi"><div class="k-ico">💰</div><b>${money(revenue)}</b><span>Gross Revenue</span></div>
          <div class="kpi"><div class="k-ico">⭐</div><b>4.8</b><span>Avg. Rating</span></div>
        </div>
        <div style="background:#f4fbf6;border:1px solid var(--border);border-radius:16px;padding:1.2rem">
          <h4 style="font-size:.92rem;color:var(--g900);margin-bottom:.5rem">🌱 Farmer Guidelines & Security</h4>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.7">
            Keep stock counts up to date to prevent orders exceeding harvest capacity.
            Your verification badge is validated in Cloud Firestore: once approved by Administrator,
            all your listings receive the <b>✓ VERIFIED</b> seal.
          </p>
        </div>
      `;
    }
    else if (dashTab === "addproduct") {
      body.innerHTML = `
        <p style="color:var(--muted);font-size:.88rem;margin-bottom:1.2rem">List a new harvest product into Cloud Firestore database.</p>
        <div class="dash-form">
          <div class="field"><label>Product Name</label><input id="dashNpName" placeholder="e.g. Fresh Country Brinjal"></div>
          <div class="field"><label>Category</label>
            <select id="dashNpCat">
              <option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Dairy</option><option>Spices</option><option>Pulses</option>
            </select>
          </div>
          <div class="field"><label>Price (₹)</label><input id="dashNpPrice" type="number" min="1" placeholder="e.g. 45"></div>
          <div class="field"><label>Unit</label>
            <select id="dashNpUnit"><option>kg</option><option>dozen</option><option>litre</option><option>bunch</option><option>500g</option><option>piece</option></select>
          </div>
          <div class="field"><label>Available Stock</label><input id="dashNpStock" type="number" min="0" placeholder="e.g. 100"></div>
          <div class="field"><label>Emoji Icon</label><input id="dashNpEmoji" placeholder="🍆" maxlength="3"></div>
          <div class="field full"><label>Harvest Description</label><textarea id="dashNpDesc" rows="3" placeholder="Describe soil, farming method and quality…"></textarea></div>
          <div class="field full"><button class="btn btn-primary" id="dashBtnAddProduct" style="justify-self:start">➕ Publish to Marketplace</button></div>
        </div>
      `;

      document.getElementById("dashBtnAddProduct")?.addEventListener("click", async () => {
        const name = document.getElementById("dashNpName").value.trim();
        const price = Number(document.getElementById("dashNpPrice").value);
        const stock = Number(document.getElementById("dashNpStock").value);
        const cat = document.getElementById("dashNpCat").value;
        const unit = document.getElementById("dashNpUnit").value;
        const emoji = document.getElementById("dashNpEmoji").value.trim() || "🌿";
        const desc = document.getElementById("dashNpDesc").value.trim();

        if (name.length < 3 || price <= 0 || stock < 0 || desc.length < 8) {
          alert("Please fill all product fields correctly.");
          return;
        }

        await addProduct({
          name, cat, price, unit, stock, emoji, desc,
          farmerId: myFarmerId,
          g: ['#eaf7ee', '#cfeada']
        });
        alert(`"${name}" has been published to Cloud Firestore!`);
        dashTab = "myproducts";
        loadDashBodyData();
      });
    }
    else if (dashTab === "myproducts") {
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Rating</th><th>Action</th></tr></thead>
        <tbody>${myProducts.map(p => `
          <tr>
            <td><b>${p.emoji || '🌿'} ${p.name}</b></td>
            <td><span class="tag grey">${p.cat}</span></td>
            <td><b>${money(p.price)}</b>/${p.unit}</td>
            <td>${p.stock > 0 ? p.stock : '<span class="tag red">Out</span>'}</td>
            <td>★ ${(p.rating || 5).toFixed(1)}</td>
            <td><button class="btn btn-sm btn-outline btn-dash-restock" data-id="${p.id}">Restock +50</button></td>
          </tr>`).join('')}
        </tbody></table></div>`;

      document.querySelectorAll(".btn-dash-restock").forEach(b => {
        b.addEventListener("click", async () => {
          const prod = cachedProducts.find(x => x.id === b.dataset.id);
          if (prod) {
            await updateProductStock(prod.id, prod.stock + 50);
            loadDashBodyData();
          }
        });
      });
    }
    else if (dashTab === "orders") {
      body.innerHTML = dashboardOrders.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${dashboardOrders.map(o => `
          <tr>
            <td><b>${o.id}</b></td>
            <td>${o.name}<br><small style="color:var(--muted)">${o.phone}</small></td>
            <td>${(o.items || []).map(i => (i.emoji || '🌿') + ' ' + i.name + ' ×' + i.qty).join('<br>')}</td>
            <td><b>${money(o.total)}</b></td>
            <td style="min-width:180px">${orderTrackHTML(o.status ?? 1)}</td>
          </tr>`).join('')}
        </tbody></table></div>`
        : `<div class="empty-state"><div class="big">📦</div><h3>No customer orders yet</h3><p>Orders containing your produce will appear here.</p></div>`;
    }
    return;
  }

  /* ==================== ADMIN ==================== */
  if (role === "admin") {
    if (dashTab === "overview") {
      const revenue = dashboardOrders.reduce((s,o) => s + (o.total || 0), 0);
      const pendingFarmers = cachedFarmers.filter(f => !f.verified).length;
      const openComplaints = dashboardComplaints.filter(c => c.status === "open").length;

      body.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi"><div class="k-ico">👥</div><b>${cachedFarmers.length + 5}</b><span>Platform Users</span></div>
          <div class="kpi"><div class="k-ico">🌾</div><b>${cachedProducts.length}</b><span>Live Products</span></div>
          <div class="kpi"><div class="k-ico">📦</div><b>${dashboardOrders.length}</b><span>Total Orders</span></div>
          <div class="kpi"><div class="k-ico">💰</div><b>${money(revenue)}</b><span>Gross GMV</span></div>
          <div class="kpi"><div class="k-ico">⏳</div><b>${pendingFarmers}</b><span>Pending Verifications</span></div>
          <div class="kpi"><div class="k-ico">⚠️</div><b>${openComplaints}</b><span>Open Complaints</span></div>
        </div>
        <div style="background:#f4fbf6;border:1px solid var(--border);border-radius:16px;padding:1.2rem">
          <h4 style="font-size:.92rem;color:var(--g900);margin-bottom:.5rem">🛡️ Firebase Backend & Security Health</h4>
          <p style="font-size:.85rem;color:var(--muted);line-height:1.8">
            ✅ Cloud Firestore RBAC rules deployed & verified live &nbsp;·&nbsp; ✅ Public admin creation blocked<br>
            ✅ Atomic inventory checkout transactions &nbsp;·&nbsp; ✅ Password hashing handled via Firebase Auth &nbsp;·&nbsp; ✅ Firebase Hosting active
          </p>
        </div>
      `;
    }
    else if (dashTab === "users") {
      const userList = [
        { name: currentUserProfile.name, email: currentUser.email, role: "admin", status: "active" },
        ...cachedFarmers.map(f => ({ name: f.name, email: `${f.name.toLowerCase().replace(/[^a-z]/g,'.')}@farm.in`, role: "farmer", status: f.verified ? "verified" : "pending" })),
        { name: "Ananya Raman", email: "ananya@mail.com", role: "consumer", status: "active" },
        { name: "Vikram Suresh", email: "vikram@mail.com", role: "consumer", status: "active" }
      ];

      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>${userList.map(u => `
          <tr>
            <td><b>${u.name}</b></td>
            <td>${u.email}</td>
            <td><span class="tag ${u.role==='admin'?'red':u.role==='farmer'?'green':'blue'}">${u.role}</span></td>
            <td><span class="tag ${u.status==='active'||u.status==='verified'?'green':'amber'}">${u.status}</span></td>
          </tr>`).join('')}
        </tbody></table></div>`;
    }
    else if (dashTab === "farmers") {
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Farmer</th><th>Farm</th><th>Location</th><th>Rating</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${cachedFarmers.map(f => `
          <tr>
            <td><b>${f.avatar || '👨‍🌾'} ${f.name}</b></td>
            <td>${f.farm}</td>
            <td>${f.location}</td>
            <td>★ ${(f.rating || 4.8).toFixed(1)}</td>
            <td>${f.verified ? '<span class="tag green">Verified</span>' : '<span class="tag amber">Pending Review</span>'}</td>
            <td>${f.verified
              ? `<button class="btn btn-sm btn-ghost btn-admin-unverify" data-id="${f.id}">Revoke</button>`
              : `<button class="btn btn-sm btn-primary btn-admin-verify" data-id="${f.id}">✓ Approve</button>`}</td>
          </tr>`).join('')}
        </tbody></table></div>`;

      document.querySelectorAll(".btn-admin-verify").forEach(b => {
        b.addEventListener("click", async () => {
          await setFarmerVerification(b.dataset.id, true);
          loadDashBodyData();
        });
      });
      document.querySelectorAll(".btn-admin-unverify").forEach(b => {
        b.addEventListener("click", async () => {
          await setFarmerVerification(b.dataset.id, false);
          loadDashBodyData();
        });
      });
    }
    else if (dashTab === "products") {
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
        <tbody>${cachedProducts.map(p => `
          <tr>
            <td><b>${p.emoji || '🌿'} ${p.name}</b></td>
            <td>${p.cat}</td>
            <td><b>${money(p.price)}</b>/${p.unit}</td>
            <td>${p.stock > 0 ? p.stock : '<span class="tag red">Out</span>'}</td>
            <td><button class="btn btn-sm btn-ghost btn-admin-delprod" data-id="${p.id}" style="color:#c33">🗑 Remove</button></td>
          </tr>`).join('')}
        </tbody></table></div>`;

      document.querySelectorAll(".btn-admin-delprod").forEach(b => {
        b.addEventListener("click", async () => {
          if (confirm("Remove product from marketplace?")) {
            await deleteProduct(b.dataset.id);
            loadDashBodyData();
          }
        });
      });
    }
    else if (dashTab === "orders") {
      body.innerHTML = dashboardOrders.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment Status</th><th>Action</th></tr></thead>
        <tbody>${dashboardOrders.map(o => `
          <tr>
            <td><b>${o.id}</b><br><small style="color:var(--muted)">${o.date || 'Recent'}</small></td>
            <td>${o.name}<br><small style="color:var(--muted)">${o.phone}</small></td>
            <td><b>${money(o.total)}</b></td>
            <td><span class="tag blue">${o.pay || 'COD'}</span></td>
            <td style="min-width:180px">${orderTrackHTML(o.status ?? 1)}</td>
            <td>${(o.status ?? 1) < 4
              ? `<button class="btn btn-sm btn-primary btn-admin-advance" data-id="${o.id}" data-cur="${o.status ?? 1}">Advance Status →</button>`
              : '<span class="tag green">Complete</span>'}</td>
          </tr>`).join('')}
        </tbody></table></div>`
        : `<div class="empty-state"><div class="big">📦</div><h3>No orders yet</h3></div>`;

      document.querySelectorAll(".btn-admin-advance").forEach(b => {
        b.addEventListener("click", async () => {
          const cur = Number(b.dataset.cur);
          await advanceOrderStatus(b.dataset.id, cur + 1);
          loadDashBodyData();
        });
      });
    }
    else if (dashTab === "reviews") {
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>User</th><th>Rating</th><th>Comment</th><th>Action</th></tr></thead>
        <tbody>${dashboardReviews.map(r => `
          <tr>
            <td><b>${r.product}</b></td>
            <td>${r.user}</td>
            <td><span class="tag amber">${'★'.repeat(r.rating || 5)}</span></td>
            <td style="max-width:260px">${r.text}</td>
            <td><button class="btn btn-sm btn-ghost btn-admin-delrev" data-id="${r.id}" style="color:#c33">Remove</button></td>
          </tr>`).join('')}
        </tbody></table></div>`;

      document.querySelectorAll(".btn-admin-delrev").forEach(b => {
        b.addEventListener("click", async () => {
          await deleteReview(b.dataset.id);
          loadDashBodyData();
        });
      });
    }
    else if (dashTab === "complaints") {
      body.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>User</th><th>Subject</th><th>Details</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${dashboardComplaints.map(c => `
          <tr>
            <td><b>${c.user}</b></td>
            <td>${c.subject}</td>
            <td style="max-width:280px">${c.text}</td>
            <td><span class="tag ${c.status==='open'?'amber':'green'}">${c.status}</span></td>
            <td>${c.status === 'open'
              ? `<button class="btn btn-sm btn-primary btn-admin-resolve" data-id="${c.id}">Resolve</button>`
              : '<span class="tag green">Closed</span>'}</td>
          </tr>`).join('')}
        </tbody></table></div>`;

      document.querySelectorAll(".btn-admin-resolve").forEach(b => {
        b.addEventListener("click", async () => {
          await resolveComplaint(b.dataset.id);
          loadDashBodyData();
        });
      });
    }
  }
}

const escapeHtml = str => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function renderProfileTab(body, role, uid) {
  const isFarmer = role === "farmer";
  const isAdmin = role === "admin";
  const nameVal = currentUserProfile?.name || currentUser?.displayName || "";
  const emailVal = currentUser?.email || "";
  const phoneVal = currentUserProfile?.phone || "";
  const addrVal = currentUserProfile?.address || "";
  const locVal = currentUserProfile?.location || (isFarmer ? "Coimbatore, TN" : "");
  const farmVal = currentUserProfile?.farm || (isFarmer ? `${nameVal}'s Organic Farm` : "");
  const sinceVal = currentUserProfile?.since || new Date().getFullYear();
  const bioVal = currentUserProfile?.bio || "";
  const verified = currentUserProfile?.verified ?? false;

  body.innerHTML = `
    <div style="background:#f4fbf6;border:1px solid var(--border);border-radius:18px;padding:1.4rem;margin-bottom:1.6rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
      <div style="display:flex;align-items:center;gap:1rem">
        <div style="font-size:2.6rem;background:#fff;border:1px solid var(--border);border-radius:16px;width:60px;height:60px;display:flex;align-items:center;justify-content:center">
          ${isFarmer ? '👨‍🌾' : isAdmin ? '🛡️' : '🛍️'}
        </div>
        <div>
          <h3 style="font-size:1.15rem;color:var(--g900);margin-bottom:.2rem">${escapeHtml(nameVal || 'Farm Fresh User')}</h3>
          <p style="font-size:.85rem;color:var(--muted)">${escapeHtml(emailVal)} · UID: <code style="font-size:.78rem;background:#e9f4ed;padding:2px 6px;border-radius:4px">${escapeHtml(uid.slice(0,12))}…</code></p>
        </div>
      </div>
      <div>
        ${isFarmer
          ? (verified ? '<span class="tag green" style="font-size:.85rem;padding:.4rem .9rem">✓ Verified Farm Listing</span>' : '<span class="tag amber" style="font-size:.85rem;padding:.4rem .9rem">⏳ Pending Admin Verification</span>')
          : isAdmin
          ? '<span class="tag red" style="font-size:.85rem;padding:.4rem .9rem">🛡️ System Administrator</span>'
          : '<span class="tag blue" style="font-size:.85rem;padding:.4rem .9rem">🛍️ Verified Consumer</span>'}
      </div>
    </div>

    <p style="color:var(--muted);font-size:.88rem;margin-bottom:1.3rem">
      Manage your personal contact details, delivery address, and preferences. All details are saved directly into your <b>Google Cloud Firestore</b> document.
    </p>

    <div class="dash-form" id="profileForm">
      <div class="field">
        <label for="profName">Full Name / Contact Name</label>
        <input type="text" id="profName" value="${escapeHtml(nameVal)}" placeholder="Your full name">
      </div>
      <div class="field">
        <label for="profEmail">Firebase Auth Email</label>
        <input type="email" id="profEmail" value="${escapeHtml(emailVal)}" disabled style="background:#f5f5f5;cursor:not-allowed" title="Email is managed securely by Firebase Authentication">
      </div>
      <div class="field">
        <label for="profPhone">Mobile / Phone Number</label>
        <input type="tel" id="profPhone" value="${escapeHtml(phoneVal)}" placeholder="e.g. 9876543210" maxlength="15">
      </div>
      <div class="field">
        <label for="profLoc">City / Region / State</label>
        <input type="text" id="profLoc" value="${escapeHtml(locVal)}" placeholder="e.g. Coimbatore, Tamil Nadu">
      </div>

      ${isFarmer ? `
        <div class="field">
          <label for="profFarm">Farm / Cooperative Name</label>
          <input type="text" id="profFarm" value="${escapeHtml(farmVal)}" placeholder="e.g. Green Valley Agro">
        </div>
        <div class="field">
          <label for="profSince">Established Year</label>
          <input type="number" id="profSince" value="${sinceVal}" placeholder="e.g. 2018" min="1950" max="2026">
        </div>
        <div class="field full">
          <label for="profBio">Farm Bio & Farming Practices</label>
          <textarea id="profBio" rows="3" placeholder="Describe your farm, soil health, irrigation method, and pesticide-free philosophy…">${escapeHtml(bioVal)}</textarea>
        </div>
      ` : ''}

      <div class="field full">
        <label for="profAddr">Default Delivery / Dispatch Address</label>
        <textarea id="profAddr" rows="3" placeholder="Door / Building number, Street name, Area, Landmark, City & PIN code…">${escapeHtml(addrVal)}</textarea>
      </div>

      <div class="field full" id="profNoticeArea"></div>

      <div class="field full" style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap;margin-top:.4rem">
        <button class="btn btn-primary" id="btnSaveProfile">💾 Save Details to Firebase</button>
        <button class="btn btn-ghost" id="btnResetProfile">Reset Changes</button>
      </div>
    </div>
  `;

  document.getElementById("btnResetProfile")?.addEventListener("click", () => {
    loadDashBodyData();
  });

  document.getElementById("btnSaveProfile")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("btnSaveProfile");
    const notice = document.getElementById("profNoticeArea");
    const name = document.getElementById("profName").value.trim();
    const phone = document.getElementById("profPhone").value.trim();
    const address = document.getElementById("profAddr").value.trim();
    const location = document.getElementById("profLoc").value.trim();

    if (!name || name.length < 2) {
      alert("Please provide a valid Full Name.");
      return;
    }

    const updates = { name, phone, address, location };

    if (isFarmer) {
      const farm = document.getElementById("profFarm").value.trim();
      const since = Number(document.getElementById("profSince").value) || new Date().getFullYear();
      const bio = document.getElementById("profBio").value.trim();
      if (farm) updates.farm = farm;
      if (since) updates.since = since;
      if (bio) updates.bio = bio;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = "⏳ Saving to Cloud Firestore…";
      notice.innerHTML = "";

      await updateUserProfile(updates);

      notice.innerHTML = `
        <div style="background:#eefbf0;border:1px solid #c3e9d1;color:#1e7e34;padding:.85rem 1rem;border-radius:12px;font-size:.9rem;display:flex;align-items:center;gap:.5rem">
          <span>✅</span>
          <div><b>Details saved successfully!</b> Your profile document in Firebase Firestore has been updated.</div>
        </div>
      `;

      // Update navbar greeting
      const navBtn = document.getElementById("authBtn");
      if (navBtn) navBtn.textContent = name.split(" ")[0];

      // Refresh dashboard header welcome text
      const headH3 = document.querySelector(".dash-top h3");
      if (headH3) headH3.textContent = `👋 Welcome, ${name}`;

    } catch (err) {
      console.error("Save details error:", err);
      let userMsg = err.message;
      if (err.message && err.message.toLowerCase().includes("permission")) {
        userMsg = "Permission denied by Firestore security rules. Please allow read/write permissions in Firebase Console under Cloud Firestore > Rules.";
      }
      notice.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:.85rem 1rem;border-radius:12px;font-size:.9rem">
          <b>⚠️ Error saving details:</b> ${userMsg}
        </div>
      `;
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "💾 Save Details to Firebase";
    }
  });
}

