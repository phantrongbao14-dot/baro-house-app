/* Baro House / Tòa nhà 316 — MVP demo app logic */
(function () {
  "use strict";

  var STORAGE_KEY = "baro-house-316-v1";
  var SEED = window.BARO_SEED;

  /* ---------- State ---------- */
  var state = load();

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Không đọc được localStorage, dùng seed.", e);
    }
    return deepClone(SEED);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Không lưu được localStorage.", e);
    }
  }

  function resetData() {
    state = deepClone(SEED);
    save();
  }

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function fmtVND(n) {
    n = Number(n) || 0;
    return n.toLocaleString("vi-VN") + " đ";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }

  function statusLabel(key) { return (state.statusLabels && state.statusLabels[key]) || key || "—"; }
  function statusColor(key) { return (state.statusColors && state.statusColors[key]) || "vacant"; }

  function roomById(id) { return state.rooms.filter(function (r) { return r.id === id; })[0]; }
  function tenantById(id) { return state.tenants.filter(function (t) { return t.id === id; })[0]; }
  function contractsForRoom(id) { return state.contracts.filter(function (c) { return c.roomId === id; }); }
  function tenantsForRoom(id) { return state.tenants.filter(function (t) { return t.roomId === id && t.active; }); }
  function vehiclesForRoom(id) { return state.vehicles.filter(function (v) { return v.roomId === id; }); }

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    var el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    var ico = kind === "err" ? "⛔" : kind === "warn" ? "⚠️" : "✅";
    el.innerHTML = '<span>' + ico + "</span><span>" + esc(msg) + "</span>";
    $("toasts").appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(function () { el.remove(); }, 300);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  function openModal(title, bodyHtml, footerHtml) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = bodyHtml;
    $("modalFooter").innerHTML = footerHtml || "";
    $("modal").classList.add("show");
  }
  function closeModal() { $("modal").classList.remove("show"); }

  /* ---------- Room panel ---------- */
  function openPanel(roomId) {
    var room = roomById(roomId);
    if (!room) return;
    $("panelTitle").textContent = "Phòng " + room.label;
    $("panelSub").textContent = "Tầng " + room.floor + " · " + statusLabel(room.badge || room.status) + " · " + fmtVND(room.rent) + "/tháng";

    var lease = contractsForRoom(roomId).filter(function (c) { return c.type === "lease"; })[0];
    var deposit = contractsForRoom(roomId).filter(function (c) { return c.type === "deposit"; })[0];
    var tenants = tenantsForRoom(roomId);
    var vehicles = vehiclesForRoom(roomId);
    var assets = (state.assets && state.assets[roomId]) || [];
    var history = (state.rentHistory && state.rentHistory[roomId]) || [];

    var html = "";

    // 1. HĐ thuê
    html += section("📄", "Hợp đồng thuê", lease
      ? kv("Mã HĐ", esc(lease.code)) + kv("Thời hạn", fmtDate(lease.startDate) + " → " + fmtDate(lease.endDate)) +
        kv("Tiền thuê", fmtVND(lease.rent)) + kv("Trạng thái", badge(lease.status))
      : '<div class="empty">Chưa có hợp đồng thuê.</div>');

    // 2. HĐ cọc
    html += section("🔐", "Hợp đồng cọc", deposit
      ? kv("Mã HĐ", esc(deposit.code)) + kv("Thời hạn", fmtDate(deposit.startDate) + " → " + fmtDate(deposit.endDate)) +
        kv("Tiền cọc", fmtVND(deposit.deposit))
      : (lease ? kv("Tiền cọc (theo HĐ thuê)", fmtVND(lease.deposit)) : '<div class="empty">Chưa có hợp đồng cọc.</div>'));

    // 3. Khách hàng
    var khHtml = tenants.length
      ? tenants.map(function (t) {
          return '<div class="mini-card"><b>' + esc(t.name) + "</b><div class=\"cc-sub\" style=\"font-size:.78rem;color:var(--muted)\">" +
            esc(t.gender) + " · " + esc(t.phone) + " · CCCD " + esc(t.cccd) + "</div></div>";
        }).join("")
      : '<div class="empty">Chưa có khách thuê.</div>';
    html += section("👥", "Khách hàng (" + tenants.length + ")", khHtml);

    // 4. Xe
    var xeHtml = vehicles.length
      ? '<div class="chip-list">' + vehicles.map(function (v) {
          return '<span class="chip">' + (v.type === "Ô tô" ? "🚗 " : "🛵 ") + esc(v.plate) + "</span>";
        }).join("") + "</div>"
      : '<div class="empty">Chưa có xe.</div>';
    html += section("🛵", "Xe (" + vehicles.length + ")", xeHtml);

    // 5. Tài sản
    var tsHtml = assets.length
      ? '<div class="chip-list">' + assets.map(function (a) { return '<span class="chip">' + esc(a) + "</span>"; }).join("") + "</div>"
      : '<div class="empty">Chưa ghi nhận tài sản.</div>';
    html += section("📦", "Tài sản (" + assets.length + ")", tsHtml);

    // 6. Lịch sử
    var lsHtml = history.length
      ? history.slice().reverse().map(function (h) {
          return '<div class="hist-item"><div class="h-date">' + fmtDate(h.from) + " → " + fmtDate(h.to) +
            '</div><div><b>' + esc(h.tenant) + "</b> · " + esc(h.note) + "</div></div>";
        }).join("")
      : '<div class="empty">Chưa có lịch sử.</div>';
    html += section("🕑", "Lịch sử thuê", lsHtml);

    // mock actions
    html += '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem">' +
      '<button class="btn btn-sm" onclick="App.mock(\'In PDF hợp đồng\')">🖨️ In PDF</button>' +
      '<button class="btn btn-sm" onclick="App.mock(\'Tạo phiếu thu\')">🧾 Phiếu thu</button>' +
      '<button class="btn btn-sm btn-danger" onclick="App.mock(\'Thanh lý hợp đồng\')">📕 Thanh lý</button></div>';

    $("panelBody").innerHTML = html;
    $("roomPanel").classList.add("show");
    $("panelOverlay").classList.add("show");

    function section(ico, title, inner) {
      return '<div class="panel-section"><div class="ps-head"><span class="ico">' + ico + "</span>" + title + "</div>" + inner + "</div>";
    }
    function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>"; }
  }

  function badge(statusKey) {
    return '<span class="badge bg-' + statusColor(statusKey) + '">' + esc(statusLabel(statusKey)) + "</span>";
  }

  function closePanel() {
    $("roomPanel").classList.remove("show");
    $("panelOverlay").classList.remove("show");
  }

  /* ---------- Render: Rooms ---------- */
  function renderRooms() {
    // legend
    var keys = ["ok", "new_contract", "renew", "expiring", "deposit", "management", "vacant"];
    $("roomLegend").innerHTML = keys.map(function (k) {
      return '<span class="legend-item"><span class="dot c-' + statusColor(k) + '"></span>' + esc(statusLabel(k)) + "</span>";
    }).join("");

    var floors = ["G", "1", "2", "3"];
    var html = floors.map(function (f) {
      var rooms = state.rooms.filter(function (r) { return r.floor === f; });
      if (!rooms.length) return "";
      var cards = rooms.map(function (r) {
        var key = r.badge || r.status;
        var color = statusColor(key);
        return '<div class="room-card s-' + color + '" onclick="App.openPanel(\'' + r.id + '\')">' +
          '<div class="room-id">' + esc(r.label) + "</div>" +
          '<div class="room-rent">' + (r.status === "vacant" ? "Đang trống" : fmtVND(r.rent) + "/tháng") + "</div>" +
          '<span class="badge bg-' + color + '">' + esc(statusLabel(key)) + "</span></div>";
      }).join("");
      return '<div class="floor"><div class="floor-head"><div class="floor-tag">' + esc(f) +
        '</div><div><div class="name">Tầng ' + esc(f) + '</div><div class="count">' + rooms.length + " phòng</div></div></div>" +
        '<div class="room-grid">' + cards + "</div></div>";
    }).join("");
    $("roomMap").innerHTML = html;
  }

  /* ---------- Render: Contracts ---------- */
  function renderContracts() {
    var cs = state.contracts;
    var renting = state.rooms.filter(function (r) { return r.status === "renting"; }).length;
    var expiring = cs.filter(function (c) { return c.status === "expiring"; }).length;
    var totalRent = cs.reduce(function (s, c) { return s + (c.type === "lease" ? c.rent : 0); }, 0);
    $("contractStats").innerHTML =
      stat("Tổng hợp đồng", cs.length) +
      stat("Phòng đang thuê", renting) +
      stat("Sắp hết hạn", expiring) +
      stat("Doanh thu thuê/tháng", fmtVND(totalRent), true);

    $("contractList").innerHTML = cs.map(function (c) {
      var room = roomById(c.roomId);
      var names = c.tenantIds.map(function (id) { var t = tenantById(id); return t ? t.name : "?"; }).join(", ");
      return '<div class="contract-card"><div class="cc-room">' + esc(room ? room.label : c.roomId) + "</div>" +
        '<div class="cc-main"><div class="cc-code">' + esc(c.code) + "</div>" +
        '<div class="cc-sub">' + esc(names) + " · " + fmtDate(c.startDate) + " → " + fmtDate(c.endDate) + "</div>" +
        '<div style="margin-top:.35rem">' + badge(c.status) + "</div></div>" +
        '<div class="cc-money"><span>Thuê</span><b>' + fmtVND(c.rent) + "</b><span>Cọc " + fmtVND(c.deposit) + "</span></div></div>";
    }).join("");
  }

  /* ---------- Render: Create revenue ---------- */
  function ensureRows(period) {
    if (period.rows) return period.rows;
    period.rows = state.rooms
      .filter(function (r) { return r.status === "renting"; })
      .map(function (r) {
        return { roomId: r.id, label: r.label, electric: 0, water: 0, fee: 0, rent: r.rent };
      });
    return period.rows;
  }

  function rowTotal(row) { return (Number(row.electric) || 0) + (Number(row.water) || 0) + (Number(row.fee) || 0) + (Number(row.rent) || 0); }
  function periodTotal(period) { return (period.rows || []).reduce(function (s, r) { return s + rowTotal(r); }, 0); }

  function renderCreateRevenue() {
    var wrap = $("createRevenuePeriods");
    var prevApproved = true;
    wrap.innerHTML = state.revenuePeriods.map(function (p, idx) {
      var unlocked = idx === 0 ? true : prevApproved;
      var thisApproved = p.approved;
      prevApproved = p.approved;

      if (!unlocked) {
        return '<div class="period locked"><div class="period-head"><div class="p-title">🔒 Kỳ ' + esc(p.label) +
          '</div></div><div class="locked-note">🔒 Kỳ trước chưa lưu bill — chưa thể mở kỳ này.</div></div>';
      }

      var rows = ensureRows(p);
      var body = "";
      var head = '<div class="period-head"><div class="p-title">📅 Kỳ ' + esc(p.label) +
        (thisApproved ? ' <span class="badge bg-success">Đã lưu</span>' : ' <span class="badge bg-warning">Đang mở</span>') +
        '</div><div class="stat" style="padding:.4rem .8rem"><span class="label">Tổng kỳ</span> <b class="value" style="font-size:1.05rem">' +
        fmtVND(periodTotal(p)) + "</b></div></div>";

      var tableRows = rows.map(function (row, ri) {
        var dis = thisApproved ? "disabled" : "";
        return "<tr><td><b>" + esc(row.label) + "</b></td>" +
          '<td><input class="rev-input" type="number" min="0" value="' + row.electric + '" ' + dis +
          ' oninput="App.updateRev(\'' + p.id + "'," + ri + ",'electric',this.value)\"></td>" +
          '<td><input class="rev-input" type="number" min="0" value="' + row.water + '" ' + dis +
          ' oninput="App.updateRev(\'' + p.id + "'," + ri + ",'water',this.value)\"></td>" +
          '<td><input class="rev-input" type="number" min="0" value="' + row.fee + '" ' + dis +
          ' oninput="App.updateRev(\'' + p.id + "'," + ri + ",'fee',this.value)\"></td>" +
          '<td><input class="rev-input" type="number" min="0" value="' + row.rent + '" ' + dis +
          ' oninput="App.updateRev(\'' + p.id + "'," + ri + ",'rent',this.value)\"></td>" +
          '<td class="rev-total" data-total="' + p.id + "-" + ri + '">' + fmtVND(rowTotal(row)) + "</td></tr>";
      }).join("");

      body = '<div class="period-body table-wrap"><table><thead><tr><th>Phòng</th><th>Điện</th><th>Nước</th>' +
        "<th>Phí phát sinh</th><th>Tiền phòng</th><th>Tổng</th></tr></thead><tbody>" + tableRows + "</tbody></table>" +
        (thisApproved
          ? '<div style="margin-top:1rem;color:var(--success);font-weight:600">✅ Bill kỳ này đã được lưu.</div>'
          : '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button class="btn btn-primary" onclick="App.saveBill(\'' +
            p.id + "')\">💾 Lưu bill kỳ " + esc(p.label) + "</button></div>") +
        "</div>";

      return '<div class="period">' + head + body + "</div>";
    }).join("");
  }

  /* ---------- Render: Building revenue ---------- */
  function renderRevenue() {
    var approved = state.revenuePeriods.filter(function (p) { return p.approved; });
    var grand = approved.reduce(function (s, p) { return s + periodTotal(p); }, 0);
    $("revenueStats").innerHTML =
      stat("Kỳ đã chốt", approved.length) +
      stat("Tổng doanh thu", fmtVND(grand), true) +
      stat("Số phòng thu", approved.length ? (approved[approved.length - 1].rows || []).length : 0);

    if (!approved.length) {
      $("buildingRevenue").innerHTML = '<div class="card"><div class="card-body empty">Chưa có kỳ nào được chốt. Hãy lưu bill ở tab “Tạo kỳ doanh thu”.</div></div>';
      return;
    }

    $("buildingRevenue").innerHTML = approved.map(function (p) {
      var rows = p.rows || [];
      var body = rows.map(function (r) {
        return "<tr><td><b>" + esc(r.label) + "</b></td><td>" + fmtVND(r.electric) + "</td><td>" + fmtVND(r.water) +
          "</td><td>" + fmtVND(r.fee) + "</td><td>" + fmtVND(r.rent) + '</td><td class="rev-total">' + fmtVND(rowTotal(r)) + "</td></tr>";
      }).join("");
      return '<div class="card" style="margin-bottom:1rem"><div class="card-header"><h3>Bill kỳ ' + esc(p.label) +
        '</h3><span class="badge bg-primary">' + fmtVND(periodTotal(p)) + "</span></div>" +
        '<div class="card-body table-wrap"><table><thead><tr><th>Phòng</th><th>Điện</th><th>Nước</th><th>Phí</th>' +
        "<th>Phòng</th><th>Tổng</th></tr></thead><tbody>" + body + "</tbody></table></div></div>";
    }).join("");
  }

  /* ---------- Render: Customers ---------- */
  function renderCustomers() {
    var body = state.tenants.map(function (t, i) {
      var room = roomById(t.roomId);
      return "<tr><td>" + (i + 1) + "</td><td><b>" + esc(t.name) + "</b></td><td>" + esc(t.gender) +
        "</td><td>" + esc(t.phone) + "</td><td>" + esc(t.cccd) + "</td><td>" + fmtDate(t.dob) +
        "</td><td>" + esc(room ? room.label : (t.roomId || "—")) + "</td><td>" +
        (t.active ? '<span class="badge bg-success">Đang thuê</span>' : '<span class="badge bg-vacant">Đã rời</span>') +
        '</td><td style="text-align:right;white-space:nowrap">' +
        (t.active ? '<button class="btn btn-sm btn-danger" onclick="App.moveOut(\'' + t.id + "')\">Chuyển ra</button>" : "—") +
        "</td></tr>";
    }).join("");
    $("customerTable").innerHTML = body;
  }

  /* ---------- Render: Vehicles ---------- */
  function renderVehicles() {
    $("vehicleGrid").innerHTML = state.vehicles.map(function (v) {
      var t = tenantById(v.tenantId);
      var room = roomById(v.roomId);
      var icon = v.type === "Ô tô" ? "🚗" : "🛵";
      return '<div class="vehicle-card"><div class="vehicle-photo">' + icon +
        '</div><div class="vehicle-info"><div class="plate">' + esc(v.plate) + "</div>" +
        '<div class="v-sub">' + esc(v.type) + " · Phòng " + esc(room ? room.label : v.roomId) + "</div>" +
        '<div class="v-sub">👤 ' + esc(t ? t.name : "—") + "</div></div></div>";
    }).join("");
  }

  function stat(label, value, accent) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value' + (accent ? " accent" : "") + '">' + value + "</div></div>";
  }

  /* ---------- Tab switching ---------- */
  var TAB_TITLES = {
    rooms: "Sơ đồ phòng",
    contracts: "Hợp đồng thuê",
    "create-revenue": "Tạo kỳ doanh thu",
    revenue: "Doanh thu tòa nhà",
    customers: "Khách hàng",
    vehicles: "Thống kê xe",
  };

  function switchTab(tab) {
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".tab-pane").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + tab);
    });
    $("pageTitle").textContent = TAB_TITLES[tab] || tab;
    renderTab(tab);
    closeSidebar();
  }

  function renderTab(tab) {
    if (tab === "rooms") renderRooms();
    else if (tab === "contracts") renderContracts();
    else if (tab === "create-revenue") renderCreateRevenue();
    else if (tab === "revenue") renderRevenue();
    else if (tab === "customers") renderCustomers();
    else if (tab === "vehicles") renderVehicles();
  }

  /* ---------- Sidebar (mobile) ---------- */
  function openSidebar() { $("sidebar").classList.add("show"); $("sidebarBackdrop").classList.add("show"); }
  function closeSidebar() { $("sidebar").classList.remove("show"); $("sidebarBackdrop").classList.remove("show"); }

  /* ---------- Public actions ---------- */
  var App = {
    openPanel: openPanel,

    mock: function (label) { toast(label + " (demo) — thao tác mock.", "warn"); },

    updateRev: function (periodId, rowIdx, field, value) {
      var p = state.revenuePeriods.filter(function (x) { return x.id === periodId; })[0];
      if (!p || !p.rows || !p.rows[rowIdx]) return;
      p.rows[rowIdx][field] = Number(value) || 0;
      var cell = document.querySelector('[data-total="' + periodId + "-" + rowIdx + '"]');
      if (cell) cell.textContent = fmtVND(rowTotal(p.rows[rowIdx]));
      // update period total header live
      save();
      var headStat = cell && cell.closest(".period").querySelector(".period-head .value");
      if (headStat) headStat.textContent = fmtVND(periodTotal(p));
    },

    saveBill: function (periodId) {
      var idx = -1;
      state.revenuePeriods.forEach(function (p, i) { if (p.id === periodId) idx = i; });
      if (idx < 0) return;
      var p = state.revenuePeriods[idx];
      p.approved = true;
      // open next period sequentially
      if (state.revenuePeriods[idx + 1]) state.revenuePeriods[idx + 1].opened = true;
      save();
      renderCreateRevenue();
      toast("Đã lưu bill kỳ " + p.label + " · Tổng " + fmtVND(periodTotal(p)), "ok");
    },

    moveOut: function (tenantId) {
      var t = tenantById(tenantId);
      if (!t) return;
      t.active = false;
      var prevRoom = t.roomId;
      t.roomId = null;
      save();
      renderCustomers();
      toast("Đã chuyển " + t.name + " ra khỏi phòng " + (prevRoom || ""), "ok");
    },

    openCustomerModal: function () {
      var roomOpts = state.rooms.map(function (r) { return '<option value="' + r.id + '">' + esc(r.label) + "</option>"; }).join("");
      openModal("Thêm khách hàng",
        '<div class="field"><label>Họ tên *</label><input id="f_name" placeholder="Nguyễn Văn A"></div>' +
        '<div class="field-row"><div class="field"><label>Giới tính</label><select id="f_gender"><option>Nam</option><option>Nữ</option></select></div>' +
        '<div class="field"><label>SĐT</label><input id="f_phone" placeholder="09xxxxxxxx"></div></div>' +
        '<div class="field-row"><div class="field"><label>CCCD</label><input id="f_cccd"></div>' +
        '<div class="field"><label>Ngày sinh</label><input id="f_dob" type="date"></div></div>' +
        '<div class="field"><label>Phòng</label><select id="f_room">' + roomOpts + "</select></div>",
        '<button class="btn" onclick="App.closeModal()">Hủy</button>' +
        '<button class="btn btn-primary" onclick="App.submitCustomer()">Lưu khách</button>');
    },

    submitCustomer: function () {
      var name = $("f_name").value.trim();
      if (!name) { toast("Vui lòng nhập họ tên.", "err"); return; }
      state.tenants.push({
        id: uid("t"), name: name, gender: $("f_gender").value, phone: $("f_phone").value.trim(),
        cccd: $("f_cccd").value.trim(), dob: $("f_dob").value, roomId: $("f_room").value, active: true,
      });
      save();
      closeModal();
      renderCustomers();
      toast("Đã thêm khách hàng " + name, "ok");
    },

    openVehicleModal: function () {
      var tenantOpts = state.tenants.filter(function (t) { return t.active; })
        .map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + " (P." + esc(t.roomId) + ")</option>"; }).join("");
      openModal("Thêm xe",
        '<div class="field"><label>Biển số *</label><input id="f_plate" placeholder="59X-12345"></div>' +
        '<div class="field"><label>Loại xe</label><select id="f_vtype"><option>Xe máy</option><option>Ô tô</option></select></div>' +
        '<div class="field"><label>Chủ xe</label><select id="f_owner">' + tenantOpts + "</select></div>",
        '<button class="btn" onclick="App.closeModal()">Hủy</button>' +
        '<button class="btn btn-primary" onclick="App.submitVehicle()">Lưu xe</button>');
    },

    submitVehicle: function () {
      var plate = $("f_plate").value.trim();
      if (!plate) { toast("Vui lòng nhập biển số.", "err"); return; }
      var ownerId = $("f_owner").value;
      var owner = tenantById(ownerId);
      state.vehicles.push({
        id: uid("v"), plate: plate.toUpperCase(), type: $("f_vtype").value,
        tenantId: ownerId, roomId: owner ? owner.roomId : null, photo: null,
      });
      save();
      closeModal();
      renderVehicles();
      toast("Đã thêm xe " + plate.toUpperCase(), "ok");
    },

    openContractModal: function () {
      var vacant = state.rooms.filter(function (r) { return r.status !== "renting"; });
      var roomOpts = (vacant.length ? vacant : state.rooms)
        .map(function (r) { return '<option value="' + r.id + '">' + esc(r.label) + " · " + fmtVND(r.rent) + "</option>"; }).join("");
      var tenantOpts = state.tenants.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + "</option>"; }).join("");
      openModal("Lập hợp đồng thuê",
        '<div class="field"><label>Phòng *</label><select id="f_croom">' + roomOpts + "</select></div>" +
        '<div class="field"><label>Khách đại diện</label><select id="f_ctenant">' + tenantOpts + "</select></div>" +
        '<div class="field-row"><div class="field"><label>Ngày bắt đầu</label><input id="f_cstart" type="date"></div>' +
        '<div class="field"><label>Ngày kết thúc</label><input id="f_cend" type="date"></div></div>' +
        '<div class="field-row"><div class="field"><label>Tiền thuê</label><input id="f_crent" type="number" placeholder="0"></div>' +
        '<div class="field"><label>Tiền cọc</label><input id="f_cdep" type="number" placeholder="0"></div></div>',
        '<button class="btn" onclick="App.closeModal()">Hủy</button>' +
        '<button class="btn btn-primary" onclick="App.submitContract()">Lập HĐ</button>');
    },

    submitContract: function () {
      var roomId = $("f_croom").value;
      var room = roomById(roomId);
      if (!room) { toast("Chọn phòng hợp lệ.", "err"); return; }
      var rent = Number($("f_crent").value) || room.rent;
      var start = $("f_cstart").value || new Date().toISOString().slice(0, 10);
      var code = room.label + "/316-" + start.replace(/-/g, "") + "-HĐTP";
      state.contracts.push({
        id: uid("c"), code: code, roomId: roomId, tenantIds: [$("f_ctenant").value],
        startDate: start, endDate: $("f_cend").value || "", rent: rent,
        deposit: Number($("f_cdep").value) || rent, status: "new_contract", type: "lease",
      });
      room.status = "renting";
      room.badge = "new_contract";
      save();
      closeModal();
      renderContracts();
      toast("Đã lập hợp đồng phòng " + room.label, "ok");
    },

    resetBuilding: function () {
      openModal("Cấu hình tòa nhà",
        '<p style="font-size:.88rem;color:var(--muted)">Đặt lại toàn bộ dữ liệu demo về trạng thái gốc (seed). Thao tác này xóa các thay đổi đã lưu trong trình duyệt.</p>',
        '<button class="btn" onclick="App.closeModal()">Hủy</button>' +
        '<button class="btn btn-danger" onclick="App.doReset()">Đặt lại dữ liệu</button>');
    },

    doReset: function () {
      resetData();
      closeModal();
      var active = document.querySelector(".nav-item.active");
      renderTab(active ? active.getAttribute("data-tab") : "rooms");
      toast("Đã đặt lại dữ liệu về seed gốc.", "ok");
    },

    closeModal: closeModal,
  };

  window.App = App;

  /* ---------- Init ---------- */
  function init() {
    // topbar action: reset/config
    $("topbarActions").innerHTML =
      '<button class="btn btn-sm" onclick="App.resetBuilding()">⚙️ Cấu hình tòa nhà</button>';

    // nav
    $("nav").addEventListener("click", function (e) {
      var btn = e.target.closest(".nav-item");
      if (btn) switchTab(btn.getAttribute("data-tab"));
    });

    // panel / modal / sidebar close handlers
    $("panelClose").addEventListener("click", closePanel);
    $("panelOverlay").addEventListener("click", closePanel);
    $("modalClose").addEventListener("click", closeModal);
    $("modalBackdrop").addEventListener("click", closeModal);
    $("menuToggle").addEventListener("click", openSidebar);
    $("sidebarBackdrop").addEventListener("click", closeSidebar);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closePanel(); closeModal(); }
    });

    switchTab("rooms");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
