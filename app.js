/* Baro House — MVP SPA (schema v3: company › khu vực › tòa) */
(function () {
  "use strict";

  const STORAGE_KEY = "baro-house-v3";
  const SCHEMA = 3;
  const TITLES = {
    rooms: "Sơ đồ phòng",
    contracts: "Hợp đồng thuê",
    "thu-tien": "Thu tiền kỳ",
    "kiem-tra-bill": "Kiểm tra Bill",
    "bao-cao": "Báo cáo tòa",
    customers: "Khách hàng",
    vehicles: "Thống kê xe",
    "cau-hinh": "Cấu hình tòa",
    csv: "Import / Export CSV",
  };

  let state = null;
  let currentRoomId = null;
  let editingCustomerId = null;
  let editingVehicleId = null;
  let roomFilter = "all";
  let roomsSub = "phong";
  let vehicleQuery = "";
  let currentBuilding = "316";
  let currentAreaId = "kv1";
  let shellView = "home"; // home | area | building | employees | ceo-report
  let customerFilter = "living"; // living | moved | all

  function emptyBuildingBundle(meta) {
    const seed = window.BARO_SEED;
    const floors = Number(meta.floors) || 1;
    const building = {
      name: "Baro House",
      code: meta.code,
      address: meta.address || "",
      area: meta.areaName || "",
      manager: meta.manager || "",
      floors: floors,
      floorAlias: Array.from({ length: floors }, (_, i) => String(i)).join(","),
      consultPrice: 4000000,
      electricRate: 3500,
      waterRate: 20000,
      serviceFee: 50000,
      vehicleFee: 100000,
      collectDay: "ngày 1",
      waterCalc: "đầu người",
      bankAccount: "",
      bankName: "",
      bankHolder: "",
      qrPlaceholder: true,
    };
    return {
      building,
      rooms: [],
      tenants: [],
      contracts: [],
      vehicles: [],
      assets: {},
      warehouse: [],
      rentHistory: {},
      revenuePeriods: deepClone(seed.revenuePeriods).map((p, i) => ({
        ...p,
        opened: i === 0,
        rows: [],
      })),
      monthlyReport: [
        { month: "7/2026", rent: 0, electric: 0, water: 0, service: 0, vehicle: 0, extra: 0 },
        { month: "8/2026", rent: 0, electric: 0, water: 0, service: 0, vehicle: 0, extra: 0 },
      ],
    };
  }

  function seededBuildingBundle() {
    const seed = window.BARO_SEED;
    return {
      building: deepClone(seed.building),
      rooms: deepClone(seed.rooms),
      tenants: deepClone(seed.tenants),
      contracts: deepClone(seed.contracts),
      vehicles: deepClone(seed.vehicles),
      assets: deepClone(seed.assets),
      warehouse: deepClone(seed.warehouse),
      rentHistory: deepClone(seed.rentHistory),
      revenuePeriods: deepClone(seed.revenuePeriods),
      monthlyReport: deepClone(seed.monthlyReport),
    };
  }

  function prepareActivePeriods() {
    if (!state.revenuePeriods || !state.revenuePeriods.length) return;
    if (!state.revenuePeriods[0].rows) {
      ensurePeriodRows(state.revenuePeriods[0]);
    }
    state.revenuePeriods[0].opened = true;
  }

  function applyBundleToState(bundle) {
    state.building = bundle.building;
    state.rooms = bundle.rooms || [];
    state.tenants = bundle.tenants || [];
    state.contracts = bundle.contracts || [];
    state.vehicles = bundle.vehicles || [];
    state.assets = bundle.assets || {};
    state.warehouse = bundle.warehouse || [];
    state.rentHistory = bundle.rentHistory || {};
    state.revenuePeriods = bundle.revenuePeriods || [];
    state.monthlyReport = bundle.monthlyReport || [];
  }

  function snapshotActiveBundle() {
    return {
      building: deepClone(state.building),
      rooms: deepClone(state.rooms),
      tenants: deepClone(state.tenants),
      contracts: deepClone(state.contracts),
      vehicles: deepClone(state.vehicles),
      assets: deepClone(state.assets),
      warehouse: deepClone(state.warehouse),
      rentHistory: deepClone(state.rentHistory),
      revenuePeriods: deepClone(state.revenuePeriods),
      monthlyReport: deepClone(state.monthlyReport),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed._schema === SCHEMA && parsed.areas && parsed.buildingStore) {
          state = parsed;
          if (!state.employees || !state.employees.length) {
            state.employees = deepClone(window.BARO_SEED.employees);
          }
          currentBuilding = state.activeBuildingCode || "316";
          const bundle = state.buildingStore[currentBuilding];
          if (bundle) applyBundleToState(bundle);
          else applyBundleToState(seededBuildingBundle());
          normalizeAssets();
          if (state.rooms && state.rooms.length && state.revenuePeriods && state.revenuePeriods[0] && !state.revenuePeriods[0].rows) {
            prepareActivePeriods();
          }
          return;
        }
      }
    } catch (_) {}
    // Clear legacy keys so old v1/v2 never collide
    try {
      localStorage.removeItem("baro-house-316-v1");
      localStorage.removeItem("baro-house-v2");
    } catch (_) {}
    bootFromSeed();
  }

  function bootFromSeed() {
    const seed = window.BARO_SEED;
    const areas = deepClone(seed.areas);
    const store = {};
    areas.forEach((area) => {
      (area.buildings || []).forEach((b) => {
        if (b.seeded) store[b.code] = seededBuildingBundle();
        else store[b.code] = emptyBuildingBundle({ ...b, areaName: area.name });
      });
    });
    if (!store["316"]) store["316"] = seededBuildingBundle();
    state = {
      _schema: SCHEMA,
      employees: deepClone(seed.employees || []),
      areas,
      buildingStore: store,
      activeBuildingCode: "316",
    };
    applyBundleToState(store["316"]);
    currentBuilding = "316";
    normalizeAssets();
    prepareActivePeriods();
    // re-snapshot after period rows filled
    state.buildingStore["316"] = snapshotActiveBundle();
    saveState();
  }

  function normalizeAssets() {
    if (!state.warehouse) state.warehouse = deepClone(window.BARO_SEED.warehouse);
    if (!state.building) state.building = deepClone(window.BARO_SEED.building);
    if (!state.monthlyReport) state.monthlyReport = deepClone(window.BARO_SEED.monthlyReport);
    if (!state.employees) state.employees = deepClone(window.BARO_SEED.employees || []);
    if (!state.areas) state.areas = deepClone(window.BARO_SEED.areas || []);
    if (!state.buildingStore) state.buildingStore = {};
    Object.keys(state.assets || {}).forEach((rid) => {
      const list = state.assets[rid];
      if (Array.isArray(list) && list.length && typeof list[0] === "string") {
        state.assets[rid] = list.map((name, i) => ({
          id: "leg-" + rid + "-" + i,
          name,
          photos: ["📷"],
        }));
      }
    });
  }

  function persistActiveBuilding() {
    if (!state || !state.buildingStore) return;
    const code = state.activeBuildingCode || currentBuilding || state.building.code;
    state.buildingStore[code] = snapshotActiveBundle();
    state.activeBuildingCode = code;
  }

  function saveState() {
    persistActiveBuilding();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function fmtMoney(n) {
    if (n == null || n === "") return "—";
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function statusLabel(key) {
    return (window.BARO_SEED.statusLabels && window.BARO_SEED.statusLabels[key]) || key;
  }

  function statusColor(key) {
    return (window.BARO_SEED.statusColors && window.BARO_SEED.statusColors[key]) || "ok";
  }

  function badgeHtml(status) {
    if (!status) return "";
    const color = statusColor(status);
    return `<span class="badge badge-${color}">${statusLabel(status)}</span>`;
  }

  function contractTone(c, room) {
    if (!c) return "no_contract";
    if (c.type === "deposit") return "deposit";
    return c.status || (room && room.badge) || "ok";
  }

  function roomChipHtml(room) {
    if (room.badge === "expiring") {
      return `<span class="status-chip chip-expiring">Sắp hết hạn</span>`;
    }
    if (room.badge === "ban_mgmt" || room.badge === "management") {
      return `<span class="status-chip chip-ban">Ban Q.Lý</span>`;
    }
    let key = room.status;
    if (room.badge === "overdue" || room.status === "overdue") key = "overdue";
    const map = {
      vacant: ["chip-empty", "Trống"],
      renting: ["chip-renting", "Đang thuê"],
      deposit_hold: ["chip-deposit", "Giữ cọc"],
      deposit: ["chip-deposit", "Giữ cọc"],
      maintenance: ["chip-maint", "Bảo trì"],
      overdue: ["chip-overdue", "Quá hạn"],
    };
    const m = map[key] || map.renting;
    return `<span class="status-chip ${m[0]}">${m[1]}</span>`;
  }

  function roomTenants(roomId) {
    return state.tenants.filter((t) => t.roomId === roomId && t.active !== false);
  }

  function roomContract(roomId) {
    return state.contracts.find((c) => c.roomId === roomId && c.type === "lease");
  }

  function roomDepositContract(roomId) {
    return state.contracts.find((c) => c.roomId === roomId && c.type === "deposit");
  }

  function tenantById(id) {
    return state.tenants.find((t) => t.id === id);
  }

  function roomById(id) {
    return state.rooms.find((r) => r.id === id);
  }

  function initials(name) {
    const parts = (name || "").trim().split(/\s+/);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function toast(msg, type) {
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.textContent = msg;
    document.getElementById("toasts").appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 2800);
  }

  function normalizePlate(p) {
    return String(p || "").toUpperCase().replace(/[\s.\-_/]/g, "");
  }

  function totalDepositHeld() {
    return state.contracts
      .filter((c) => c.type === "lease" || c.type === "deposit")
      .reduce((s, c) => s + (Number(c.deposit) || 0), 0);
  }

  function matchesRoomFilter(r) {
    if (roomFilter === "all") return true;
    if (roomFilter === "renting") return r.status === "renting";
    if (roomFilter === "vacant") return r.status === "vacant";
    if (roomFilter === "maintenance") return r.status === "maintenance";
    if (roomFilter === "deposit_hold") return r.status === "deposit_hold" || r.status === "deposit";
    if (roomFilter === "overdue") return r.badge === "overdue" || r.status === "overdue";
    if (roomFilter === "expiring") return r.badge === "expiring";
    return true;
  }

  function ensurePeriodRows(period) {
    if (period.rows) {
      period.rows.forEach((row) => {
        if (!row.billState) row.billState = period._saved ? "saved" : "draft";
        if (row.elecOld == null) row.elecOld = 1000 + Math.floor(Math.random() * 500);
        if (row.elecNew == null) row.elecNew = row.elecOld + Math.floor(20 + Math.random() * 80);
        if (row.waterOld == null) row.waterOld = 10 + Math.floor(Math.random() * 20);
        if (row.waterNew == null) row.waterNew = row.waterOld + Math.floor(1 + Math.random() * 8);
        if (row.vehicleFee == null) row.vehicleFee = state.building.vehicleFee || 100000;
        if (row.serviceFee == null) row.serviceFee = state.building.serviceFee || 50000;
        if (row.balancePrev == null) row.balancePrev = Math.random() > 0.8 ? -50000 : Math.random() > 0.7 ? 30000 : 0;
        if (row.paidCk == null) row.paidCk = 0;
        if (row.extraNote == null) row.extraNote = "";
        if (row.elecRate == null) row.elecRate = state.building.electricRate || 3500;
        recalcBillRow(row);
      });
      return;
    }
    const occupied = state.rooms.filter(
      (r) => r.status === "renting" || r.status === "deposit_hold" || r.status === "deposit"
    );
    period.rows = occupied.map((r) => {
      const tenants = roomTenants(r.id);
      const names = tenants.map((t) => t.name).join(", ") || "—";
      const rent = r.rent || 0;
      const elecOld = 1000 + Math.floor(Math.random() * 500);
      const elecNew = elecOld + Math.floor(20 + Math.random() * 80);
      const waterOld = 10 + Math.floor(Math.random() * 20);
      const waterNew = waterOld + Math.floor(1 + Math.random() * 8);
      const people = Math.max(1, tenants.length);
      const row = {
        roomId: r.id,
        tenantName: names,
        elecOld,
        elecNew,
        elecRate: state.building.electricRate || 3500,
        waterOld,
        waterNew,
        waterPeople: people,
        waterRate: state.building.waterRate || 20000,
        vehicleFee: state.building.vehicleFee || 100000,
        serviceFee: state.building.serviceFee || 50000,
        extra: Math.random() > 0.7 ? Math.round(Math.random() * 100000) : 0,
        extraNote: "",
        balancePrev: Math.random() > 0.8 ? -50000 : Math.random() > 0.7 ? 30000 : 0,
        paidCk: 0,
        rent,
        electric: 0,
        water: 0,
        total: 0,
        billState: "draft",
      };
      recalcBillRow(row);
      return row;
    });
  }

  function recalcBillRow(row) {
    const kwh = Math.max(0, (Number(row.elecNew) || 0) - (Number(row.elecOld) || 0));
    row.electric = kwh * (Number(row.elecRate) || 3500);
    if (state.building.waterCalc === "đồng hồ") {
      const m3 = Math.max(0, (Number(row.waterNew) || 0) - (Number(row.waterOld) || 0));
      row.water = m3 * (Number(row.waterRate) || 20000);
    } else {
      row.water = (Number(row.waterPeople) || 1) * (Number(row.waterRate) || 20000);
    }
    row.total =
      (Number(row.rent) || 0) +
      (Number(row.electric) || 0) +
      (Number(row.water) || 0) +
      (Number(row.vehicleFee) || 0) +
      (Number(row.serviceFee) || 0) +
      (Number(row.extra) || 0) +
      (Number(row.balancePrev) || 0);
  }


  /* ── Hierarchy navigation (L1 company › L2 area › L3 building) ── */
  function getArea(id) {
    return (state.areas || []).find((a) => a.id === id);
  }

  function findBuildingMeta(code) {
    for (const area of state.areas || []) {
      const b = (area.buildings || []).find((x) => x.code === code);
      if (b) return { area, building: b };
    }
    return null;
  }

  function managerEmployees() {
    return (state.employees || []).filter((e) => {
      const t = e.title || "";
      return /Quản lý/i.test(t) || /Trưởng phòng/i.test(t);
    });
  }

  function updateChrome() {
    const back = document.getElementById("btnBack");
    const menu = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("mainShell");
    const picker = document.getElementById("buildingPicker");
    const crumb = document.getElementById("breadcrumb");
    const title = document.getElementById("pageTitle");

    const onBuilding = shellView === "building";
    document.body.classList.toggle("mode-building", onBuilding);
    document.body.classList.toggle("mode-shell", !onBuilding);

    if (sidebar) sidebar.style.display = onBuilding ? "" : "none";
    if (main) {
      if (onBuilding) main.style.marginLeft = "";
      else main.style.marginLeft = "0";
    }
    if (menu) menu.style.display = onBuilding ? "" : "none";
    if (picker) picker.style.display = "none"; // hierarchy replaces picker
    if (back) back.style.display = shellView === "home" ? "none" : "";

    document.querySelectorAll(".shell-pane").forEach((p) => {
      p.classList.toggle("active", p.id === "shell-" + shellView);
    });

    let crumbs = ["Baro House"];
    let page = "Baro House";
    if (shellView === "home") {
      page = "Baro House";
    } else if (shellView === "area") {
      const a = getArea(currentAreaId);
      crumbs.push(a ? a.name : "Khu vực");
      page = a ? a.name : "Khu vực";
    } else if (shellView === "building") {
      const found = findBuildingMeta(currentBuilding);
      if (found) {
        crumbs.push(found.area.name);
        crumbs.push("Tòa " + found.building.code);
        page = TITLES.rooms;
      } else {
        crumbs.push("Tòa " + currentBuilding);
        page = TITLES.rooms;
      }
      const sub = document.getElementById("sidebarBuilding");
      if (sub) sub.textContent = "Tòa nhà " + currentBuilding;
      const meta = document.getElementById("sidebarMeta");
      if (meta && found) {
        meta.textContent = found.area.name + " · " + (found.building.manager || "—");
      }
    } else if (shellView === "employees") {
      crumbs.push("Nhân viên");
      page = "Nhân viên";
    } else if (shellView === "ceo-report") {
      crumbs.push("Báo cáo");
      page = "Báo cáo CEO";
    }
    if (crumb) crumb.textContent = crumbs.join(" › ");
    if (title && shellView !== "building") title.textContent = page;
  }

  function goHome() {
    if (shellView === "building") persistActiveBuilding();
    shellView = "home";
    closePanel();
    closeSidebar();
    updateChrome();
    renderHome();
    document.getElementById("topbarActions").innerHTML = "";
    saveState();
  }

  function goArea(areaId) {
    if (shellView === "building") persistActiveBuilding();
    currentAreaId = areaId || currentAreaId;
    shellView = "area";
    closePanel();
    closeSidebar();
    updateChrome();
    renderArea();
    document.getElementById("topbarActions").innerHTML = "";
    saveState();
  }

  function goEmployees() {
    shellView = "employees";
    closePanel();
    updateChrome();
    renderEmployees();
    document.getElementById("topbarActions").innerHTML = "";
  }

  function goCeoReport() {
    shellView = "ceo-report";
    closePanel();
    updateChrome();
    renderCeoReport();
    document.getElementById("topbarActions").innerHTML = "";
  }

  function goBack() {
    if (shellView === "building") goArea(currentAreaId);
    else if (shellView === "area" || shellView === "employees" || shellView === "ceo-report") goHome();
  }

  function renderHome() {
    const grid = document.getElementById("areaGrid");
    const areas = state.areas || [];
    grid.innerHTML = areas
      .map((a) => {
        const n = (a.buildings || []).length;
        return `
        <button type="button" class="nav-card area-card" onclick="App.goArea('${a.id}')">
          <span class="nav-card-icon">🏢</span>
          <div>
            <strong>${esc(a.code)}</strong>
            <div class="muted">${esc(a.name)} · ${n} tòa</div>
          </div>
        </button>`;
      })
      .join("");
    const empN = (state.employees || []).length;
    const eh = document.getElementById("empCountHome");
    if (eh) eh.textContent = String(empN);
  }

  function renderArea() {
    const area = getArea(currentAreaId);
    const label = document.getElementById("areaSectionLabel");
    if (label) label.textContent = area ? "Tòa nhà — " + area.name : "Tòa nhà";
    const grid = document.getElementById("buildingGrid");
    const list = (area && area.buildings) || [];
    if (!list.length) {
      grid.innerHTML = `<div class="empty-hint">Chưa có tòa nhà. Bấm 「＋ Tạo tòa nhà」 để thêm.</div>`;
      return;
    }
    grid.innerHTML = list
      .map((b) => `
        <button type="button" class="nav-card building-card" onclick="App.enterBuilding('${esc(b.code)}')">
          <span class="nav-card-icon">🏠</span>
          <div>
            <strong>Tòa ${esc(b.code)}</strong>
            <div class="muted">${esc(b.address || "—")}</div>
            <div class="muted">QL: ${esc(b.manager || "—")} · ${b.floors || "—"} tầng</div>
          </div>
        </button>`)
      .join("");
  }

  function renderEmployees() {
    const list = (state.employees || []).slice().sort((a, b) => (a.stt || 0) - (b.stt || 0));
    const label = document.getElementById("empCountLabel");
    if (label) label.textContent = list.length + " người";
    const tbody = document.getElementById("employeeTable");
    tbody.innerHTML = list
      .map(
        (e) => `
      <tr>
        <td>${e.stt}</td>
        <td><strong>${esc(e.name)}</strong></td>
        <td>${esc(e.title)}</td>
      </tr>`
      )
      .join("");
  }

  function renderCeoReport() {
    // Prefer seeded building data for demo charts
    const seeded = state.buildingStore["316"] || snapshotActiveBundle();
    const report = seeded.monthlyReport || [];
    const rooms = seeded.rooms || [];
    const occ = rooms.filter((r) => r.status === "renting" || r.status === "deposit_hold").length;
    const vacant = rooms.filter((r) => r.status === "vacant").length;
    const last = report[report.length - 1] || {};
    const totalLast =
      (last.rent || 0) +
      (last.electric || 0) +
      (last.water || 0) +
      (last.service || 0) +
      (last.vehicle || 0) +
      (last.extra || 0);

    document.getElementById("ceoReportTiles").innerHTML = `
      <div class="stat-card"><div class="label">Khu vực</div><div class="value">${(state.areas || []).length}</div></div>
      <div class="stat-card"><div class="label">Tòa nhà</div><div class="value">${Object.keys(state.buildingStore || {}).length}</div></div>
      <div class="stat-card"><div class="label">Nhân viên</div><div class="value">${(state.employees || []).length}</div></div>
      <div class="stat-card"><div class="label">Phòng đang thuê (316)</div><div class="value success">${occ}</div></div>
      <div class="stat-card"><div class="label">Phòng trống (316)</div><div class="value danger">${vacant}</div></div>
      <div class="stat-card"><div class="label">DT tháng gần nhất</div><div class="value">${fmtMoney(totalLast)}</div></div>
    `;

    const maxBar = Math.max(...report.map((m) => m.rent + m.electric + m.water + m.service + m.vehicle + m.extra), 1);
    document.getElementById("ceoBarChart").innerHTML = `
      <div class="bar-chart">${report
        .map((m) => {
          const t = m.rent + m.electric + m.water + m.service + m.vehicle + m.extra;
          const h = Math.round((t / maxBar) * 100);
          return `<div class="bar-col"><div class="bar" style="height:${h}%"></div><div class="bar-label">${esc(m.month)}</div></div>`;
        })
        .join("")}</div>`;

    const parts = [
      ["Thuê", last.rent || 0, "#6D28D9"],
      ["Điện", last.electric || 0, "#0284C7"],
      ["Nước", last.water || 0, "#059669"],
      ["DV", last.service || 0, "#D97706"],
      ["Xe", last.vehicle || 0, "#DC2626"],
      ["PS", last.extra || 0, "#64748B"],
    ];
    const sum = parts.reduce((s, p) => s + p[1], 0) || 1;
    let acc = 0;
    const arcs = parts
      .map((p) => {
        const pct = (p[1] / sum) * 100;
        const start = acc;
        acc += pct;
        return `<circle class="donut-seg" cx="18" cy="18" r="15.915" fill="transparent" stroke="${p[2]}" stroke-width="3.5"
          stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-start + 25}"></circle>`;
      })
      .join("");
    document.getElementById("ceoDonutChart").innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 36 36" class="donut-svg">${arcs}</svg>
        <div class="donut-legend">${parts
          .map((p) => `<div><span class="dot" style="background:${p[2]}"></span>${p[0]} · ${fmtMoney(p[1])}</div>`)
          .join("")}</div>
      </div>`;

    const rows = [];
    (state.areas || []).forEach((a) => {
      (a.buildings || []).forEach((b) => {
        rows.push(`<tr><td><strong>${esc(b.code)}</strong></td><td>${esc(a.name)}</td><td>${esc(b.manager || "—")}</td><td>${b.floors || "—"}</td></tr>`);
      });
    });
    document.getElementById("ceoBuildingRows").innerHTML =
      rows.join("") || `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Chưa có tòa</td></tr>`;
  }

  function promptCreateArea() {
    const name = window.prompt("Tên khu vực (ví dụ: Khu vực 3)");
    if (!name || !name.trim()) return;
    const n = (state.areas || []).length + 1;
    const code = "KV" + n;
    const id = "kv" + n + "-" + Date.now().toString(36);
    state.areas.push({ id, code, name: name.trim(), buildings: [] });
    saveState();
    toast("Đã tạo " + code + " — " + name.trim(), "success");
    renderHome();
  }

  function openCreateBuildingModal() {
    const mgrOpts = managerEmployees()
      .map((e) => `<option value="${esc(e.name)}">${esc(e.name)} — ${esc(e.title)}</option>`)
      .join("");
    openModal(
      "Tạo tòa nhà",
      `
      <div class="form-group"><label>Mã tòa *</label>
        <input id="nb-code" placeholder="VD: 318" /></div>
      <div class="form-group"><label>Địa chỉ</label>
        <input id="nb-address" placeholder="Địa chỉ tòa nhà" /></div>
      <div class="form-group"><label>Số tầng</label>
        <input id="nb-floors" type="number" min="1" max="50" value="5" /></div>
      <div class="form-group"><label>Quản lý tòa nhà</label>
        <select id="nb-manager"><option value="">— Chọn quản lý —</option>${mgrOpts}</select></div>
      `,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveNewBuilding()">Tạo tòa</button>`
    );
  }

  function saveNewBuilding() {
    const code = (document.getElementById("nb-code").value || "").trim();
    const address = (document.getElementById("nb-address").value || "").trim();
    const floors = Number(document.getElementById("nb-floors").value) || 1;
    const manager = document.getElementById("nb-manager").value || "";
    if (!code) {
      toast("Nhập mã tòa", "error");
      return;
    }
    if (findBuildingMeta(code)) {
      toast("Mã tòa đã tồn tại", "error");
      return;
    }
    const area = getArea(currentAreaId);
    if (!area) {
      toast("Không tìm thấy khu vực", "error");
      return;
    }
    const meta = {
      code,
      name: "Tòa nhà " + code,
      address,
      floors,
      manager,
      seeded: false,
    };
    area.buildings.push(meta);
    state.buildingStore[code] = emptyBuildingBundle({ ...meta, areaName: area.name });
    saveState();
    closeModal();
    toast("Đã tạo tòa " + code, "success");
    renderArea();
  }

  function enterBuilding(code) {
    persistActiveBuilding();
    const found = findBuildingMeta(code);
    if (!found) {
      toast("Không tìm thấy tòa " + code, "error");
      return;
    }
    currentAreaId = found.area.id;
    currentBuilding = code;
    state.activeBuildingCode = code;
    let bundle = state.buildingStore[code];
    if (!bundle) {
      bundle = found.building.seeded ? seededBuildingBundle() : emptyBuildingBundle({ ...found.building, areaName: found.area.name });
      state.buildingStore[code] = bundle;
    }
    applyBundleToState(bundle);
    normalizeAssets();
    if (state.rooms.length && state.revenuePeriods[0] && !state.revenuePeriods[0].rows) {
      prepareActivePeriods();
      state.buildingStore[code] = snapshotActiveBundle();
    }
    shellView = "building";
    roomFilter = "all";
    roomsSub = "phong";
    customerFilter = "living";
    updateChrome();
    switchTab("rooms");
    saveState();
  }

  function switchTab(tab) {
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-pane").forEach((p) => {
      p.classList.toggle("active", p.id === "tab-" + tab);
    });
    document.getElementById("pageTitle").textContent = TITLES[tab] || tab;
    if (shellView === "building") {
      const found = findBuildingMeta(currentBuilding);
      const crumb = document.getElementById("breadcrumb");
      if (crumb && found) {
        crumb.textContent = ["Baro House", found.area.name, "Tòa " + found.building.code].join(" › ");
      }
    }
    renderTopbarActions(tab);
    closePanel();
    closeSidebar();
    if (tab === "rooms") renderRooms();
    else if (tab === "contracts") renderContracts();
    else if (tab === "thu-tien") renderThuTien();
    else if (tab === "kiem-tra-bill") renderBillCheck();
    else if (tab === "bao-cao") renderReport();
    else if (tab === "customers") renderCustomers();
    else if (tab === "vehicles") renderVehicles();
    else if (tab === "cau-hinh") renderBuildingConfig();
  }

  function renderTopbarActions(tab) {
    const el = document.getElementById("topbarActions");
    if (tab === "rooms") {
      el.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="App.openContractModal()">＋ Lập HĐ thuê</button>
        <button class="btn btn-sm" onclick="App.openAddRoomModal()">＋ Thêm phòng</button>
        <button class="btn btn-sm" onclick="App.switchTab('cau-hinh')">⚙ Cấu hình tòa</button>
      `;
    } else {
      el.innerHTML = "";
    }
  }

  function openSidebar() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebarBackdrop").classList.add("open");
  }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarBackdrop").classList.remove("open");
  }

  function countByFilter(key) {
    if (key === "all") return state.rooms.length;
    const prev = roomFilter;
    roomFilter = key;
    const n = state.rooms.filter(matchesRoomFilter).length;
    roomFilter = prev;
    return n;
  }

  function renderRooms() {
    document.getElementById("roomsSubPhong").style.display = roomsSub === "phong" ? "" : "none";
    document.getElementById("roomsSubKho").style.display = roomsSub === "kho" ? "" : "none";
    document.querySelectorAll("#roomsSubTabs .sub-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.sub === roomsSub);
    });
    if (roomsSub === "kho") {
      renderWarehouse();
      return;
    }
    const tiles = [
      ["all", "Tổng", countByFilter("all"), ""],
      ["renting", "Đang thuê", countByFilter("renting"), "success"],
      ["vacant", "Trống", countByFilter("vacant"), "danger"],
      ["maintenance", "Bảo trì", countByFilter("maintenance"), ""],
      ["deposit_hold", "Giữ cọc", countByFilter("deposit_hold"), "warning"],
      ["overdue", "Quá hạn", countByFilter("overdue"), "danger"],
      ["expiring", "Sắp hết hạn", countByFilter("expiring"), "warning"],
    ];
    document.getElementById("roomStatTiles").innerHTML = tiles
      .map(
        ([key, label, val, cls]) => `
      <div class="stat-card filter-tile ${roomFilter === key ? "active" : ""}" onclick="App.setRoomFilter('${key}')" role="button">
        <div class="label">${label}</div>
        <div class="value ${cls}">${val}</div>
      </div>`
      )
      .join("");

    const legend = document.getElementById("roomLegend");
    const items = [
      ["chip-empty", "Trống"],
      ["chip-renting", "Đang thuê"],
      ["chip-deposit", "Giữ cọc"],
      ["chip-expiring", "Sắp hết hạn"],
      ["chip-maint", "Bảo trì"],
      ["chip-overdue", "Quá hạn"],
      ["chip-ban", "Ban Q.Lý"],
    ];
    legend.innerHTML = items
      .map(([c, l]) => `<div class="legend-item"><span class="status-chip ${c}" style="font-size:0.65rem;padding:0.1rem 0.4rem">${l}</span></div>`)
      .join("");

    const floors = ["G", "1", "2", "3", "4", "5"];
    const floorNames = { G: "Tầng G (Trệt)", "1": "Tầng 1", "2": "Tầng 2", "3": "Tầng 3", "4": "Tầng 4", "5": "Tầng 5" };
    const map = document.getElementById("roomMap");
    map.innerHTML = floors
      .map((f) => {
        const rooms = state.rooms.filter((r) => r.floor === f && matchesRoomFilter(r));
        if (!rooms.length && roomFilter !== "all") return "";
        return `
        <div class="floor-block">
          <div class="floor-label">${floorNames[f]}</div>
          <div class="room-grid">
            ${rooms.length ? rooms.map((r) => roomTileHtml(r)).join("") : `<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem">Không có phòng khớp bộ lọc</div>`}
          </div>
        </div>`;
      })
      .join("");
  }

  function setRoomFilter(key) {
    roomFilter = key;
    renderRooms();
  }

  function setRoomsSub(sub) {
    roomsSub = sub;
    renderRooms();
  }

  function roomTileHtml(r) {
    const tenants = roomTenants(r.id);
    const names = tenants.map((t) => t.name.split(" ").slice(-2).join(" ")).join(", ");
    const contract = roomContract(r.id) || roomDepositContract(r.id);
    const tone = contractTone(contract, r);
    let cls = "";
    if (r.status === "vacant") cls = "vacant";
    else if (r.status === "deposit_hold" || r.status === "deposit") cls = "deposit";
    else if (r.status === "maintenance") cls = "maintenance";
    else if (r.badge === "overdue") cls = "overdue";
    else if (r.badge === "expiring") cls = "expiring";
    return `
      <div class="room-tile ${cls}" onclick="App.openRoom('${r.id}')" role="button" tabindex="0">
        <div class="room-id">${r.label}</div>
        ${roomChipHtml(r)}
        <div style="margin-top:0.25rem">${badgeHtml(tone)}</div>
        <div class="room-tenant">${r.status === "vacant" ? "Trống" : r.status === "maintenance" ? "Bảo trì" : names || "—"}</div>
      </div>`;
  }

  function openRoom(roomId) {
    currentRoomId = roomId;
    const room = roomById(roomId);
    if (!room) return;
    const tenants = roomTenants(roomId);
    const contract = roomContract(roomId);
    const depositContract = roomDepositContract(roomId);
    const vehicles = state.vehicles.filter((v) => v.roomId === roomId);
    const assets = state.assets[roomId] || [];
    const history = state.rentHistory[roomId] || [];
    const isEmpty = room.status === "vacant" || room.status === "maintenance";

    document.getElementById("panelTitle").textContent = "Phòng " + room.label;
    document.getElementById("panelSub").innerHTML =
      roomChipHtml(room) + (room.rent ? ` · <span class="money">${fmtMoney(room.rent)}/tháng</span>` : "");

    let leaseSection;
    if (contract) {
      leaseSection = `
        <div class="kv-list">
          <div class="kv-row"><span class="k">Mã HĐ</span><span class="v">${contract.code}</span></div>
          <div class="kv-row"><span class="k">Thời hạn</span><span class="v">${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}</span></div>
          <div class="kv-row"><span class="k">Tiền phòng</span><span class="v money">${fmtMoney(contract.rent)}</span></div>
          <div class="kv-row"><span class="k">Tiền cọc</span><span class="v money">${fmtMoney(contract.deposit)}</span></div>
          <div class="kv-row"><span class="k">Trạng thái</span><span class="v">${badgeHtml(contract.status)}</span></div>
        </div>
        <div class="action-row">
          <button class="btn btn-sm" onclick="App.editContract('${contract.id}')">Sửa</button>
          <button class="btn btn-sm" onclick="App.mockPdf('Hợp đồng ${contract.code}')">PDF</button>
          <button class="btn btn-sm" onclick="App.mockAction('Phiếu thu kỳ đầu')">Phiếu thu kỳ đầu</button>
          <button class="btn btn-sm" onclick="App.openRenewModal('${contract.id}')">Gia hạn</button>
          <button class="btn btn-sm btn-danger" onclick="App.openLiquidateModal('${contract.id}')">Thanh lý</button>
          <button class="btn btn-sm" onclick="App.mockAction('KT khóa phòng ${roomId}')">KT khóa</button>
        </div>`;
    } else if (isEmpty) {
      leaseSection = `<div class="empty-state"><div class="emoji">📄</div>Chưa có hợp đồng thuê
        <div class="action-row" style="justify-content:center;margin-top:0.75rem">
          <button class="btn btn-primary btn-sm" onclick="App.openContractModal('${roomId}')">Lập HĐ thuê</button>
          <button class="btn btn-sm" onclick="App.openDepositContractModal('${roomId}')">Tạo HĐ cọc</button>
          <button class="btn btn-sm" onclick="App.editRoom('${roomId}')">Sửa phòng</button>
          <button class="btn btn-sm" onclick="App.editAssets('${roomId}')">Thêm tài sản</button>
        </div></div>`;
    } else {
      leaseSection = `<p style="color:var(--text-muted);font-size:0.875rem">Không có HĐ thuê đang hiệu lực. ${badgeHtml("no_contract")}</p>
        <div class="action-row">
          <button class="btn btn-primary btn-sm" onclick="App.openContractModal('${roomId}')">Lập HĐ thuê</button>
        </div>`;
    }

    let depositSection;
    if (depositContract) {
      depositSection = `
        <div class="kv-list">
          <div class="kv-row"><span class="k">Mã HĐ cọc</span><span class="v">${depositContract.code}</span></div>
          <div class="kv-row"><span class="k">Tiền cọc</span><span class="v money">${fmtMoney(depositContract.deposit)}</span></div>
          <div class="kv-row"><span class="k">Ngày cọc</span><span class="v">${fmtDate(depositContract.startDate)}</span></div>
          <div class="kv-row"><span class="k">KT xác nhận</span><span class="v">${depositContract.depositConfirmed ? '<span class="badge badge-success">Đã xác nhận</span>' : '<span class="badge badge-warning">Chưa</span>'}</span></div>
        </div>
        <div class="action-row">
          <button class="btn btn-sm" onclick="App.confirmDeposit('${depositContract.id}')">KT xác nhận cọc</button>
          <button class="btn btn-sm btn-primary" onclick="App.convertDepositToRent('${depositContract.id}')">Chuyển HĐ thuê</button>
          <button class="btn btn-sm" onclick="App.mockAction('Bỏ cọc phòng ${roomId}')">Bỏ cọc</button>
          <button class="btn btn-sm" onclick="App.mockAction('Hoàn cọc ${fmtMoney(depositContract.deposit)}')">Hoàn cọc</button>
          <button class="btn btn-sm" onclick="App.mockPdf('HĐ cọc ${depositContract.code}')">PDF</button>
        </div>`;
    } else {
      depositSection = `<p style="color:var(--text-muted);font-size:0.875rem">Không có HĐ cọc đang hiệu lực.</p>
        ${isEmpty || !contract ? `<div class="action-row"><button class="btn btn-sm" onclick="App.openDepositContractModal('${roomId}')">Tạo HĐ cọc</button></div>` : ""}`;
    }

    document.getElementById("panelBody").innerHTML = `
      ${section("I. Hợp đồng thuê", leaseSection)}
      ${section("II. HĐ cọc", depositSection)}
      ${section(
        "III. Khách hàng",
        tenants.length
          ? tenants
              .map((t) => {
                const role = t.role === "chu" ? "Chủ HĐ" : t.role === "ocung" ? "Ở cùng" : "Khách";
                return `
            <div class="person-chip">
              <div class="avatar">${initials(t.name)}</div>
              <div class="info">
                <div class="name">${t.name} <span class="badge badge-info">${role}</span></div>
                <div class="meta">${t.gender || ""} · ${t.phone || ""} · CCCD ${t.cccd || "—"}</div>
              </div>
              <button class="btn btn-xs" onclick="App.openCustomerModal('${t.id}')">Sửa</button>
            </div>`;
              })
              .join("")
          : `<p style="color:var(--text-muted);font-size:0.875rem">Chưa có khách hàng.</p>`
      )}
      ${section(
        "IV. Xe khách",
        vehicles.length
          ? vehicles
              .map((v) => {
                const owner = tenantById(v.tenantId);
                return `<div class="kv-row" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
                  <span class="k">${v.type} · <strong>${v.plate}</strong></span>
                  <span class="v">${owner ? owner.name : "—"}</span>
                </div>`;
              })
              .join("")
          : `<p style="color:var(--text-muted);font-size:0.875rem">Chưa có xe đăng ký.</p>`
      )}
      ${section(
        "V. Tài sản phòng",
        assets.length
          ? assets
              .map((a) => {
                const photos = (a.photos || []).slice(0, 3);
                return `<div class="asset-card">
                  <div class="asset-name">${a.name}</div>
                  <div class="asset-photos">${photos.map((p) => `<span class="photo-ph">${p}</span>`).join("")}</div>
                  <div class="action-row">
                    <button class="btn btn-xs" onclick="App.editSingleAsset('${roomId}','${a.id}')">Sửa</button>
                    <button class="btn btn-xs" onclick="App.moveAssetToWarehouse('${roomId}','${a.id}')">Chuyển kho</button>
                    <button class="btn btn-xs" onclick="App.mockAction('Lịch sử tài sản ${a.name}')">Lịch sử</button>
                    <button class="btn btn-xs btn-danger" onclick="App.deleteAsset('${roomId}','${a.id}')">Xóa</button>
                  </div>
                </div>`;
              })
              .join("") +
            `<div class="action-row"><button class="btn btn-sm" onclick="App.editAssets('${roomId}')">＋ Thêm tài sản</button></div>`
          : `<p style="color:var(--text-muted);font-size:0.875rem">Chưa khai báo tài sản.</p>
             <div class="action-row"><button class="btn btn-sm" onclick="App.editAssets('${roomId}')">Thêm tài sản</button></div>`
      )}
      ${section(
        "VI. Lịch sử thuê",
        history.length
          ? history
              .map(
                (h) => `
            <div class="history-item">
              <div class="period">${fmtDate(h.from)} → ${fmtDate(h.to)}${h.at ? ` · <span style="opacity:0.7">${h.at}</span>` : ""}</div>
              <div>${h.tenant}</div>
              <div class="note">${h.note || ""}</div>
            </div>`
              )
              .join("")
          : `<p style="color:var(--text-muted);font-size:0.875rem">Chưa có lịch sử.</p>`
      )}
    `;

    document.getElementById("panelOverlay").classList.add("open");
    document.getElementById("roomPanel").classList.add("open");
  }

  function section(title, body) {
    return `
      <div class="section">
        <div class="section-title" onclick="this.parentElement.classList.toggle('collapsed')">
          <span>${title}</span>
          <span class="chevron">▾</span>
        </div>
        <div class="section-body">${body}</div>
      </div>`;
  }

  function closePanel() {
    document.getElementById("panelOverlay").classList.remove("open");
    document.getElementById("roomPanel").classList.remove("open");
    currentRoomId = null;
  }

  function renderWarehouse() {
    const list = document.getElementById("warehouseList");
    if (!state.warehouse.length) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">📦</div>Kho trống</div>`;
      return;
    }
    list.innerHTML = state.warehouse
      .map(
        (w) => `
      <div class="asset-card">
        <div class="asset-name">📦 ${w.name}</div>
        <div class="asset-photos">${(w.photos || []).slice(0, 3).map((p) => `<span class="photo-ph">${p}</span>`).join("")}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin:0.35rem 0">
          ${(w.history || []).slice(-2).map((h) => `${h.at}: ${h.note}`).join(" · ") || "—"}
        </div>
        <div class="action-row">
          <button class="btn btn-xs btn-primary" onclick="App.moveWarehouseToRoom('${w.id}')">Chuyển vào phòng</button>
          <button class="btn btn-xs" onclick="App.mockAction('Biên bản bàn giao — ${w.name}')">Biên bản bàn giao</button>
          <button class="btn btn-xs" onclick="App.mockAction('Lịch sử chuyển ${w.name}')">Lịch sử</button>
        </div>
      </div>`
      )
      .join("");
  }

  function moveAssetToWarehouse(roomId, assetId) {
    const list = state.assets[roomId] || [];
    const idx = list.findIndex((a) => a.id === assetId);
    if (idx < 0) return;
    const [asset] = list.splice(idx, 1);
    state.warehouse.push({
      id: asset.id,
      name: asset.name,
      photos: asset.photos || ["📷"],
      history: [{ at: new Date().toISOString().slice(0, 16).replace("T", " "), note: "Chuyển từ P." + roomId }],
    });
    saveState();
    toast("Đã chuyển «" + asset.name + "» vào kho", "success");
    openRoom(roomId);
  }

  function moveWarehouseToRoom(wid) {
    const rooms = state.rooms.map((r) => `<option value="${r.id}">${r.label}</option>`).join("");
    openModal(
      "Chuyển tài sản vào phòng",
      `<div class="form-group"><label>Phòng đích</label><select id="f-move-room">${rooms}</select></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.confirmMoveToRoom('${wid}')">Chuyển</button>`
    );
  }

  function confirmMoveToRoom(wid) {
    const roomId = document.getElementById("f-move-room").value;
    const idx = state.warehouse.findIndex((w) => w.id === wid);
    if (idx < 0) return;
    const [w] = state.warehouse.splice(idx, 1);
    if (!state.assets[roomId]) state.assets[roomId] = [];
    state.assets[roomId].push({ id: w.id, name: w.name, photos: w.photos || ["📷"] });
    saveState();
    closeModal();
    toast("Đã chuyển «" + w.name + "» vào P." + roomId + " · Biên bản bàn giao (mock)", "success");
    renderWarehouse();
  }

  function openAddWarehouseAsset() {
    openModal(
      "Thêm tài sản vào kho",
      `<div class="form-group"><label>Tên tài sản *</label><input id="f-wname" placeholder="Máy lạnh…" /></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveWarehouseAsset()">Thêm</button>`
    );
  }

  function saveWarehouseAsset() {
    const name = document.getElementById("f-wname").value.trim();
    if (!name) { toast("Nhập tên tài sản", "error"); return; }
    state.warehouse.push({
      id: uid("w"),
      name,
      photos: ["📷"],
      history: [{ at: new Date().toISOString().slice(0, 16).replace("T", " "), note: "Nhập kho" }],
    });
    saveState();
    closeModal();
    toast("Đã thêm vào kho", "success");
    renderWarehouse();
  }

  function deleteAsset(roomId, assetId) {
    if (!confirm("Xóa tài sản này?")) return;
    state.assets[roomId] = (state.assets[roomId] || []).filter((a) => a.id !== assetId);
    saveState();
    toast("Đã xóa tài sản", "success");
    openRoom(roomId);
  }

  function editSingleAsset(roomId, assetId) {
    const a = (state.assets[roomId] || []).find((x) => x.id === assetId);
    if (!a) return;
    openModal(
      "Sửa tài sản",
      `<div class="form-group"><label>Tên</label><input id="f-aname" value="${esc(a.name)}" /></div>
       <p style="font-size:0.8rem;color:var(--text-muted)">Ảnh: ${(a.photos || []).length}/3 placeholder</p>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveSingleAsset('${roomId}','${assetId}')">Lưu</button>`
    );
  }

  function saveSingleAsset(roomId, assetId) {
    const a = (state.assets[roomId] || []).find((x) => x.id === assetId);
    if (!a) return;
    a.name = document.getElementById("f-aname").value.trim() || a.name;
    saveState();
    closeModal();
    toast("Đã lưu tài sản", "success");
    openRoom(roomId);
  }

  /* ── Modal helpers ── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function openModal(title, bodyHtml, footerHtml) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    document.getElementById("modalFooter").innerHTML = footerHtml || "";
    document.getElementById("modal").classList.add("open");
  }

  function closeModal() {
    document.getElementById("modal").classList.remove("open");
    editingCustomerId = null;
    editingVehicleId = null;
  }

  function mockAction(label) {
    toast(String(label) + " — demo UI (chưa kết nối backend)", "info");
  }

  function mockPdf(label) {
    toast("PDF «" + label + "» — mock tải về / chia sẻ Zalo", "info");
  }

  function billStateLabel(key) {
    return (window.BARO_SEED.billStates && window.BARO_SEED.billStates[key]) || key || "—";
  }

  function billStateBadge(key) {
    const map = {
      draft: "badge-warning",
      saved: "badge-info",
      request_bill: "badge-primary",
      pending_kt: "badge-warning",
      approved: "badge-success",
      exported: "badge-success",
    };
    return `<span class="badge ${map[key] || "badge-info"} bill-state">${billStateLabel(key)}</span>`;
  }

  /* ── Contracts ── */
  function renderContracts() {
    const total = state.rooms.length;
    const vacant = state.rooms.filter((r) => r.status === "vacant").length;
    const renting = state.rooms.filter(
      (r) => r.status === "renting" || r.status === "deposit_hold" || r.status === "deposit"
    ).length;
    const dep = totalDepositHeld();

    const banner = document.getElementById("depositBanner");
    if (banner) {
      banner.innerHTML = `💰 Tổng tiền cọc đang giữ: <strong class="money">${fmtMoney(dep)}</strong>
        <span style="opacity:0.85">· ${state.contracts.filter((c) => c.type === "deposit").length} HĐ cọc · ${state.contracts.filter((c) => c.type === "lease").length} HĐ thuê</span>`;
    }

    document.getElementById("contractStats").innerHTML = `
      <div class="stat-card"><div class="label">Tổng phòng</div><div class="value">${total}</div></div>
      <div class="stat-card"><div class="label">Trống</div><div class="value danger">${vacant}</div></div>
      <div class="stat-card"><div class="label">Đang thuê / cọc</div><div class="value success">${renting}</div></div>
      <div class="stat-card"><div class="label">Tổng cọc đang giữ</div><div class="value primary money">${fmtMoney(dep)}</div></div>
    `;

    const list = document.getElementById("contractList");
    if (!state.contracts.length) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">📄</div>Chưa có hợp đồng</div>`;
      return;
    }

    list.innerHTML = state.contracts
      .map((c) => {
        const tenants = (c.tenantIds || []).map(tenantById).filter(Boolean);
        const primary = tenants[0];
        const names = tenants.map((t) => t.name).join(", ");
        const typeBadge =
          c.type === "deposit"
            ? `<span class="badge badge-deposit">HĐ cọc</span>`
            : `<span class="badge badge-info">HĐ thuê</span>`;
        return `
        <div class="contract-card" onclick="App.openRoom('${c.roomId}')">
          <div class="code">${esc(c.code)} ${typeBadge}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
            <div class="room-name">Phòng ${esc(c.roomId)}</div>
            ${badgeHtml(c.status)}
          </div>
          <div class="tenant-name">${esc(names) || "—"}</div>
          <div class="phone">📞 ${primary ? esc(primary.phone) : "—"}</div>
          <div class="dates">${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}</div>
          <div class="rent money">${fmtMoney(c.rent)}/tháng · Cọc ${fmtMoney(c.deposit)}</div>
          <div class="actions" onclick="event.stopPropagation()">
            <button class="btn btn-xs" onclick="App.editContract('${c.id}')">Sửa</button>
            <button class="btn btn-xs" onclick="App.mockPdf('${esc(c.code)}')">PDF</button>
            <button class="btn btn-xs" onclick="App.mockAction('Phiếu thu ${esc(c.code)}')">Phiếu thu</button>
            ${
              c.type === "lease"
                ? `<button class="btn btn-xs" onclick="App.openRenewModal('${c.id}')">Gia hạn</button>
                   <button class="btn btn-xs btn-danger" onclick="App.openLiquidateModal('${c.id}')">Thanh lý</button>
                   <button class="btn btn-xs" onclick="App.lockContract('${c.id}')">KT khóa</button>`
                : `<button class="btn btn-xs" onclick="App.confirmDeposit('${c.id}')">Xác nhận cọc</button>
                   <button class="btn btn-xs btn-primary" onclick="App.convertDepositToRent('${c.id}')">→ HĐ thuê</button>
                   <button class="btn btn-xs" onclick="App.mockAction('Bỏ cọc ${esc(c.code)}')">Bỏ cọc</button>
                   <button class="btn btn-xs" onclick="App.mockAction('Hoàn cọc ${fmtMoney(c.deposit)}')">Hoàn cọc</button>`
            }
          </div>
        </div>`;
      })
      .join("");
  }

  function openContractModal(roomId) {
    const preferred = roomId
      ? state.rooms.filter((r) => r.id === roomId || r.status === "vacant" || r.status === "deposit_hold")
      : state.rooms.filter((r) => r.status === "vacant" || r.status === "deposit_hold");
    const roomOpts = (preferred.length ? preferred : state.rooms)
      .map(
        (r) =>
          `<option value="${r.id}" ${roomId === r.id ? "selected" : ""}>${r.label} (${statusLabel(
            r.status === "vacant" ? "vacant" : r.badge || r.status
          )})</option>`
      )
      .join("");
    const rentDefault = roomId && roomById(roomId) ? roomById(roomId).rent || 4000000 : 4000000;
    openModal(
      "Lập hợp đồng thuê",
      `
      <div class="form-group"><label>Phòng *</label><select id="f-croom">${roomOpts}</select></div>
      <div class="form-group"><label>Họ tên khách *</label><input id="f-cname" placeholder="Nguyễn Văn A" /></div>
      <div class="form-row">
        <div class="form-group"><label>SĐT</label><input id="f-cphone" placeholder="09xxxxxxxx" /></div>
        <div class="form-group"><label>CCCD</label><input id="f-cccd2" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Từ ngày</label><input type="date" id="f-cstart" value="2026-09-01" /></div>
        <div class="form-group"><label>Đến ngày</label><input type="date" id="f-cend" value="2027-08-31" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tiền phòng (đ)</label><input type="number" id="f-crent" value="${rentDefault}" /></div>
        <div class="form-group"><label>Tiền cọc (đ)</label><input type="number" id="f-cdeposit" value="${rentDefault}" /></div>
      </div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveNewContract()">Lưu HĐ</button>`
    );
  }

  function saveNewContract() {
    const roomId = document.getElementById("f-croom").value;
    const name = document.getElementById("f-cname").value.trim();
    if (!name || !roomId) {
      toast("Nhập phòng và tên khách", "error");
      return;
    }
    if (roomContract(roomId)) {
      toast("Phòng đã có HĐ thuê — không lập trùng", "error");
      return;
    }
    const tenantId = uid("t");
    state.tenants.push({
      id: tenantId,
      name,
      gender: "Nam",
      phone: document.getElementById("f-cphone").value.trim(),
      cccd: document.getElementById("f-cccd2").value.trim(),
      dob: "",
      roomId,
      active: true,
      role: "chu",
    });
    const rent = Number(document.getElementById("f-crent").value) || 0;
    const deposit = Number(document.getElementById("f-cdeposit").value) || 0;
    const start = document.getElementById("f-cstart").value;
    const end = document.getElementById("f-cend").value;
    const code = `${roomId}/316-${(start || "").replace(/-/g, "").slice(0, 8)}-HĐTP`;
    state.contracts.push({
      id: uid("c"),
      code,
      roomId,
      tenantIds: [tenantId],
      startDate: start,
      endDate: end,
      rent,
      deposit,
      status: "new_contract",
      type: "lease",
      depositConfirmed: true,
    });
    const room = roomById(roomId);
    if (room) {
      room.status = "renting";
      room.badge = "new_contract";
      room.rent = rent;
    }
    state.contracts = state.contracts.filter((c) => !(c.roomId === roomId && c.type === "deposit"));
    if (!state.rentHistory[roomId]) state.rentHistory[roomId] = [];
    state.rentHistory[roomId].push({
      from: start,
      to: end,
      tenant: name,
      note: "HĐ mới",
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
    if (!state.assets[roomId]) {
      state.assets[roomId] = [
        { id: uid("a"), name: "Giường", photos: ["📷"] },
        { id: uid("a"), name: "Máy lạnh", photos: ["📷"] },
      ];
    }
    saveState();
    closeModal();
    toast("Đã lập hợp đồng " + code, "success");
    renderRooms();
    renderContracts();
    if (currentRoomId === roomId) openRoom(roomId);
  }

  function openDepositContractModal(roomId) {
    const preferred = roomId
      ? state.rooms.filter((r) => r.id === roomId || r.status === "vacant")
      : state.rooms.filter((r) => r.status === "vacant");
    const roomOpts = (preferred.length ? preferred : state.rooms)
      .map((r) => `<option value="${r.id}" ${roomId === r.id ? "selected" : ""}>${r.label}</option>`)
      .join("");
    const rentDefault = roomId && roomById(roomId) ? roomById(roomId).rent || 4000000 : 4000000;
    openModal(
      "Tạo hợp đồng cọc",
      `
      <div class="form-group"><label>Phòng *</label><select id="f-droom">${roomOpts}</select></div>
      <div class="form-group"><label>Họ tên khách *</label><input id="f-dname" placeholder="Nguyễn Văn A" /></div>
      <div class="form-row">
        <div class="form-group"><label>SĐT</label><input id="f-dphone" /></div>
        <div class="form-group"><label>CCCD</label><input id="f-dcccd" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ngày cọc</label><input type="date" id="f-dstart" value="2026-09-01" /></div>
        <div class="form-group"><label>Giữ đến</label><input type="date" id="f-dend" value="2026-09-30" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Giá thuê dự kiến</label><input type="number" id="f-drent" value="${rentDefault}" /></div>
        <div class="form-group"><label>Tiền cọc (đ)</label><input type="number" id="f-ddeposit" value="${Math.round(rentDefault / 2)}" /></div>
      </div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveDepositContract()">Lưu HĐ cọc</button>`
    );
  }

  function saveDepositContract() {
    const roomId = document.getElementById("f-droom").value;
    const name = document.getElementById("f-dname").value.trim();
    if (!name || !roomId) {
      toast("Nhập phòng và tên khách", "error");
      return;
    }
    if (roomDepositContract(roomId) || roomContract(roomId)) {
      toast("Phòng đã có HĐ — không tạo cọc trùng", "error");
      return;
    }
    const tenantId = uid("t");
    state.tenants.push({
      id: tenantId,
      name,
      gender: "Nam",
      phone: document.getElementById("f-dphone").value.trim(),
      cccd: document.getElementById("f-dcccd").value.trim(),
      dob: "",
      roomId,
      active: true,
      role: "chu",
    });
    const rent = Number(document.getElementById("f-drent").value) || 0;
    const deposit = Number(document.getElementById("f-ddeposit").value) || 0;
    const start = document.getElementById("f-dstart").value;
    const end = document.getElementById("f-dend").value;
    const code = `${roomId}/316-${(start || "").replace(/-/g, "").slice(0, 8)}-HĐC`;
    state.contracts.push({
      id: uid("c"),
      code,
      roomId,
      tenantIds: [tenantId],
      startDate: start,
      endDate: end,
      rent,
      deposit,
      status: "deposit",
      type: "deposit",
      depositConfirmed: false,
    });
    const room = roomById(roomId);
    if (room) {
      room.status = "deposit_hold";
      room.badge = "deposit";
      room.rent = rent;
    }
    if (!state.rentHistory[roomId]) state.rentHistory[roomId] = [];
    state.rentHistory[roomId].push({
      from: start,
      to: end,
      tenant: name,
      note: "Đang cọc",
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
    saveState();
    closeModal();
    toast("Đã tạo HĐ cọc " + code, "success");
    renderRooms();
    renderContracts();
    if (currentRoomId === roomId) openRoom(roomId);
  }

  function editContract(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    openModal(
      "Sửa hợp đồng",
      `
      <div class="form-group"><label>Mã HĐ</label><input id="f-ecode" value="${esc(c.code)}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Từ ngày</label><input type="date" id="f-estart" value="${c.startDate || ""}" /></div>
        <div class="form-group"><label>Đến ngày</label><input type="date" id="f-eend" value="${c.endDate || ""}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tiền phòng</label><input type="number" id="f-erent" value="${c.rent || 0}" /></div>
        <div class="form-group"><label>Tiền cọc</label><input type="number" id="f-edeposit" value="${c.deposit || 0}" /></div>
      </div>
      <div class="form-group"><label>Trạng thái</label>
        <select id="f-estatus">
          ${["ok", "new_contract", "expiring", "overdue", "renew", "ban_mgmt", "deposit"]
            .map((s) => `<option value="${s}" ${c.status === s ? "selected" : ""}>${statusLabel(s)}</option>`)
            .join("")}
        </select></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveEditContract('${id}')">Lưu</button>`
    );
  }

  function saveEditContract(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    c.code = document.getElementById("f-ecode").value.trim();
    c.startDate = document.getElementById("f-estart").value;
    c.endDate = document.getElementById("f-eend").value;
    c.rent = Number(document.getElementById("f-erent").value) || 0;
    c.deposit = Number(document.getElementById("f-edeposit").value) || 0;
    c.status = document.getElementById("f-estatus").value;
    const room = roomById(c.roomId);
    if (room) {
      room.badge = c.status === "ok" ? "ok" : c.status;
      room.rent = c.rent;
      if (c.type === "deposit" || c.status === "deposit") room.status = "deposit_hold";
      else room.status = "renting";
    }
    saveState();
    closeModal();
    toast("Đã cập nhật hợp đồng", "success");
    renderContracts();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function lockContract(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    c.locked = true;
    saveState();
    toast("KT đã khóa HĐ " + c.code + " (mock)", "success");
    renderContracts();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function confirmDeposit(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    c.depositConfirmed = true;
    saveState();
    toast("KT đã xác nhận cọc " + c.code, "success");
    renderContracts();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function convertDepositToRent(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c || c.type !== "deposit") return;
    if (!c.depositConfirmed) {
      toast("Cần KT xác nhận cọc trước khi chuyển HĐ thuê", "error");
      return;
    }
    const end = new Date(c.startDate || "2026-09-01");
    end.setFullYear(end.getFullYear() + 1);
    const endStr = end.toISOString().slice(0, 10);
    c.type = "lease";
    c.status = "new_contract";
    c.code = c.code.replace("-HĐC", "-HĐTP");
    c.endDate = endStr;
    const room = roomById(c.roomId);
    if (room) {
      room.status = "renting";
      room.badge = "new_contract";
      room.rent = c.rent;
    }
    saveState();
    toast("Đã chuyển HĐ cọc → HĐ thuê " + c.code, "success");
    renderRooms();
    renderContracts();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function openRenewModal(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    const nextStart = c.endDate || "2026-09-01";
    const d = new Date(nextStart);
    d.setDate(d.getDate() + 1);
    const start = d.toISOString().slice(0, 10);
    d.setFullYear(d.getFullYear() + 1);
    const end = d.toISOString().slice(0, 10);
    openModal(
      "Gia hạn HĐ " + c.code,
      `<p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:0.75rem">HĐ cũ sẽ thanh lý vào lịch sử; tạo HĐ mới với các trường dưới.</p>
      <div class="form-row">
        <div class="form-group"><label>Bắt đầu</label><input type="date" id="f-rstart" value="${start}" /></div>
        <div class="form-group"><label>Kết thúc</label><input type="date" id="f-rend" value="${end}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tiền phòng</label><input type="number" id="f-rrent2" value="${c.rent}" /></div>
        <div class="form-group"><label>Tiền cọc</label><input type="number" id="f-rdep2" value="${c.deposit}" /></div>
      </div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveRenew('${id}')">Gia hạn</button>`
    );
  }

  function saveRenew(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    const start = document.getElementById("f-rstart").value;
    const end = document.getElementById("f-rend").value;
    const rent = Number(document.getElementById("f-rrent2").value) || c.rent;
    const deposit = Number(document.getElementById("f-rdep2").value) || c.deposit;
    if (!state.rentHistory[c.roomId]) state.rentHistory[c.roomId] = [];
    const tenants = (c.tenantIds || []).map(tenantById).filter(Boolean);
    state.rentHistory[c.roomId].push({
      from: c.startDate,
      to: c.endDate,
      tenant: tenants.map((t) => t.name).join(", "),
      note: "Hết hạn — gia hạn",
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
    c.startDate = start;
    c.endDate = end;
    c.rent = rent;
    c.deposit = deposit;
    c.status = "renew";
    c.code = `${c.roomId}/316-${(start || "").replace(/-/g, "").slice(0, 8)}-HĐTP`;
    const room = roomById(c.roomId);
    if (room) {
      room.badge = "renew";
      room.rent = rent;
    }
    saveState();
    closeModal();
    toast("Đã gia hạn HĐ " + c.code, "success");
    renderContracts();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function openLiquidateModal(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    openModal(
      "Thanh lý HĐ " + c.code,
      `
      <div class="form-group"><label>Lý do</label>
        <select id="f-liq-reason">
          <option value="het_han">Hết hạn HĐ</option>
          <option value="bo_coc">Bỏ cọc / trả phòng sớm</option>
          <option value="nhuong">Thay người đứng tên</option>
          <option value="chuyen">Chuyển phòng</option>
        </select></div>
      <div class="form-row">
        <div class="form-group"><label>Số điện cuối</label><input type="number" id="f-liq-elec" value="0" /></div>
        <div class="form-group"><label>Số nước cuối</label><input type="number" id="f-liq-water" value="0" /></div>
      </div>
      <div class="form-group"><label>Ghi chú</label><textarea id="f-liq-note" rows="2"></textarea></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-danger" onclick="App.saveLiquidate('${id}')">Thanh lý</button>`
    );
  }

  function saveLiquidate(id) {
    const c = state.contracts.find((x) => x.id === id);
    if (!c) return;
    const reason = document.getElementById("f-liq-reason").value;
    const note = document.getElementById("f-liq-note").value.trim();
    const reasonLabel = {
      het_han: "Hết hạn",
      bo_coc: "Bỏ cọc",
      nhuong: "Nhượng HĐ",
      chuyen: "Chuyển phòng",
    }[reason];
    const tenants = (c.tenantIds || []).map(tenantById).filter(Boolean);
    if (!state.rentHistory[c.roomId]) state.rentHistory[c.roomId] = [];
    state.rentHistory[c.roomId].push({
      from: c.startDate,
      to: c.endDate,
      tenant: tenants.map((t) => t.name).join(", "),
      note: "Thanh lý — " + reasonLabel + (note ? ": " + note : ""),
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
    tenants.forEach((t) => {
      t.active = false;
      t.roomId = null;
    });
    state.contracts = state.contracts.filter((x) => x.id !== id);
    const room = roomById(c.roomId);
    if (room) {
      room.status = "vacant";
      room.badge = null;
    }
    saveState();
    closeModal();
    closePanel();
    toast("Đã thanh lý HĐ (" + reasonLabel + ")", "success");
    renderRooms();
    renderContracts();
  }

  /* ── Thu tiền kỳ ── */
  function renderThuTien() {
    const container = document.getElementById("createRevenuePeriods");
    container.innerHTML = state.revenuePeriods
      .map((p, idx) => {
        const prev = idx > 0 ? state.revenuePeriods[idx - 1] : null;
        const canOpen = idx === 0 || (prev && prev.opened && prev._saved);
        const locked = !p.opened && !canOpen;

        if (!p.opened && canOpen) {
          return `
            <div class="period-section">
              <div class="period-header">
                <h3>Kỳ ${p.label}</h3>
                <button class="btn btn-primary btn-sm" onclick="App.openPeriod('${p.id}')">Mở kỳ ${p.label}</button>
              </div>
              <div class="card"><div class="card-body" style="color:var(--text-muted)">
                Kỳ này chưa được mở. Nhấn «Mở kỳ» để tạo bảng thu tiền từ phòng đang thuê.
              </div></div>
            </div>`;
        }
        if (locked) {
          return `
            <div class="period-section">
              <div class="period-header"><h3>Kỳ ${p.label}</h3></div>
              <div class="locked-banner">🔒 Chưa thể mở — vui lòng lưu kỳ trước theo tuần tự.</div>
            </div>`;
        }

        ensurePeriodRows(p);
        const periodTotal = p.rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
        return `
          <div class="period-section">
            <div class="period-header">
              <h3>Kỳ ${p.label} ${
                p._saved ? '<span class="badge badge-success">Đã lưu</span>' : '<span class="badge badge-warning">Nháp</span>'
              }</h3>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" onclick="App.savePeriod('${p.id}')">💾 Lưu</button>
                <button class="btn btn-sm" onclick="App.requestAllBills('${p.id}')">📨 Yêu cầu lập bill (tất cả)</button>
              </div>
            </div>
            <div class="card"><div class="card-body table-wrap">
              <table class="bill-table">
                <thead>
                  <tr>
                    <th>STT</th><th>Phòng</th><th>Khách</th>
                    <th>Điện cũ</th><th>Điện mới</th>
                    <th>Nước cũ</th><th>Nước mới</th>
                    <th>Phát sinh</th><th>Nội dung</th><th>Đã thu CK</th>
                    <th>Tổng</th><th>Trạng thái</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  ${p.rows
                    .map((row, i) => {
                      const lockedRow = row.billState === "approved" || row.billState === "pending_kt";
                      const dis = lockedRow ? "disabled" : "";
                      return `
                    <tr>
                      <td>${i + 1}</td>
                      <td><strong>${row.roomId}</strong></td>
                      <td style="max-width:140px;font-size:0.8rem">${esc(row.tenantName)}</td>
                      <td><input type="number" value="${row.elecOld}" onchange="App.updatePeriodRow('${p.id}',${i},'elecOld',this.value)" ${dis} /></td>
                      <td><input type="number" value="${row.elecNew}" onchange="App.updatePeriodRow('${p.id}',${i},'elecNew',this.value)" ${dis} /></td>
                      <td><input type="number" value="${row.waterOld}" onchange="App.updatePeriodRow('${p.id}',${i},'waterOld',this.value)" ${dis} /></td>
                      <td><input type="number" value="${row.waterNew}" onchange="App.updatePeriodRow('${p.id}',${i},'waterNew',this.value)" ${dis} /></td>
                      <td><input type="number" value="${row.extra || 0}" onchange="App.updatePeriodRow('${p.id}',${i},'extra',this.value)" ${dis} /></td>
                      <td><input type="text" value="${esc(row.extraNote || "")}" onchange="App.updatePeriodRow('${p.id}',${i},'extraNote',this.value)" style="min-width:90px" ${dis} /></td>
                      <td><input type="number" value="${row.paidCk || 0}" onchange="App.updatePeriodRow('${p.id}',${i},'paidCk',this.value)" ${row.billState === "approved" ? "disabled" : ""} /></td>
                      <td class="money"><strong>${fmtMoney(row.total)}</strong></td>
                      <td>${billStateBadge(row.billState)}</td>
                      <td style="white-space:nowrap">
                        ${
                          row.billState === "draft" || row.billState === "saved"
                            ? `<button class="btn btn-xs btn-primary" onclick="App.requestBill('${p.id}',${i})">Yêu cầu lập bill</button>`
                            : ""
                        }
                        ${
                          row.billState === "approved" || row.billState === "pending_kt" || row.billState === "exported"
                            ? `<button class="btn btn-xs" onclick="App.showBillPdfModal('${p.id}',${i})">Bill</button>`
                            : ""
                        }
                      </td>
                    </tr>`;
                    })
                    .join("")}
                  <tr class="total-row">
                    <td colspan="10">Tổng kỳ ${p.label}</td>
                    <td class="money" colspan="2">${fmtMoney(periodTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div></div>
          </div>`;
      })
      .join("");
  }

  function openPeriod(id) {
    const p = state.revenuePeriods.find((x) => x.id === id);
    if (!p) return;
    const idx = state.revenuePeriods.indexOf(p);
    if (idx > 0) {
      const prev = state.revenuePeriods[idx - 1];
      if (!prev.opened || !prev._saved) {
        toast("Phải lưu kỳ trước trước khi mở kỳ tiếp theo", "error");
        return;
      }
    }
    p.opened = true;
    ensurePeriodRows(p);
    saveState();
    toast("Đã mở kỳ " + p.label, "success");
    renderThuTien();
  }

  function updatePeriodRow(periodId, rowIdx, field, value) {
    const p = state.revenuePeriods.find((x) => x.id === periodId);
    if (!p || !p.rows[rowIdx]) return;
    if (field === "extraNote") p.rows[rowIdx][field] = value;
    else p.rows[rowIdx][field] = Number(value) || 0;
    recalcBillRow(p.rows[rowIdx]);
    saveState();
    renderThuTien();
  }

  function savePeriod(id) {
    const p = state.revenuePeriods.find((x) => x.id === id);
    if (!p) return;
    p._saved = true;
    (p.rows || []).forEach((row) => {
      if (row.billState === "draft") row.billState = "saved";
    });
    saveState();
    toast("Đã lưu kỳ thu tiền " + p.label, "success");
    renderThuTien();
  }

  function requestBill(periodId, rowIdx) {
    const p = state.revenuePeriods.find((x) => x.id === periodId);
    if (!p || !p.rows[rowIdx]) return;
    if (!p._saved) {
      toast("Cần Lưu kỳ trước khi yêu cầu lập bill", "error");
      return;
    }
    const row = p.rows[rowIdx];
    if (row.billState !== "draft" && row.billState !== "saved" && row.billState !== "request_bill") {
      toast("Bill đã gửi / duyệt", "info");
      return;
    }
    row.billState = "pending_kt";
    saveState();
    toast("Đã gửi bill P." + row.roomId + " chờ KT duyệt", "success");
    renderThuTien();
  }

  function requestAllBills(periodId) {
    const p = state.revenuePeriods.find((x) => x.id === periodId);
    if (!p) return;
    if (!p._saved) {
      toast("Cần Lưu kỳ trước", "error");
      return;
    }
    let n = 0;
    (p.rows || []).forEach((row) => {
      if (row.billState === "draft" || row.billState === "saved" || row.billState === "request_bill") {
        row.billState = "pending_kt";
        n++;
      }
    });
    saveState();
    toast("Đã gửi " + n + " bill chờ KT", "success");
    renderThuTien();
  }

  function showBillPdfModal(periodId, rowIdx) {
    const p = state.revenuePeriods.find((x) => x.id === periodId);
    if (!p || !p.rows[rowIdx]) return;
    const r = p.rows[rowIdx];
    recalcBillRow(r);
    const due = (Number(r.total) || 0) - (Number(r.paidCk) || 0);
    openModal(
      "Bill P." + r.roomId + " · Kỳ " + p.label,
      `
      <div class="bill-preview">
        <div class="bill-preview-header">
          <strong>${esc(state.building.name)} — ${esc(state.building.code)}</strong>
          <div style="font-size:0.8rem;color:var(--text-muted)">${esc(state.building.address)}</div>
        </div>
        <div class="kv-list" style="margin-top:0.75rem">
          <div class="kv-row"><span class="k">Phòng</span><span class="v">${r.roomId}</span></div>
          <div class="kv-row"><span class="k">Khách</span><span class="v">${esc(r.tenantName)}</span></div>
          <div class="kv-row"><span class="k">Tiền phòng</span><span class="v money">${fmtMoney(r.rent)}</span></div>
          <div class="kv-row"><span class="k">Điện (${Math.max(0, r.elecNew - r.elecOld)} kWh × ${fmtMoney(r.elecRate)})</span><span class="v money">${fmtMoney(r.electric)}</span></div>
          <div class="kv-row"><span class="k">Nước</span><span class="v money">${fmtMoney(r.water)}</span></div>
          <div class="kv-row"><span class="k">Xe</span><span class="v money">${fmtMoney(r.vehicleFee)}</span></div>
          <div class="kv-row"><span class="k">Dịch vụ</span><span class="v money">${fmtMoney(r.serviceFee)}</span></div>
          <div class="kv-row"><span class="k">Phát sinh</span><span class="v money">${fmtMoney(r.extra)} ${r.extraNote ? "· " + esc(r.extraNote) : ""}</span></div>
          <div class="kv-row"><span class="k">Thiếu/Dư kỳ trước</span><span class="v money">${fmtMoney(r.balancePrev)}</span></div>
          <div class="kv-row"><span class="k"><strong>Tổng</strong></span><span class="v money"><strong>${fmtMoney(r.total)}</strong></span></div>
          <div class="kv-row"><span class="k">Đã thu CK</span><span class="v money">${fmtMoney(r.paidCk)}</span></div>
          <div class="kv-row"><span class="k">Còn lại</span><span class="v money">${fmtMoney(due)}</span></div>
        </div>
        <p style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted)">
          CK: ${esc(state.building.bankName)} · ${esc(state.building.bankAccount)} · ${esc(state.building.bankHolder)}
          ${state.building.qrPlaceholder ? " · QR placeholder" : ""}
        </p>
        <div style="margin-top:0.5rem">${billStateBadge(r.billState)}</div>
      </div>`,
      `<button class="btn" onclick="App.closeModal()">Đóng</button>
       <button class="btn" onclick="App.mockAction('Chia sẻ bill P.${r.roomId} qua Zalo')">Chia sẻ</button>
       <button class="btn btn-primary" onclick="App.mockAction('Tải về bill P.${r.roomId} PDF')">Tải về</button>`
    );
  }

  /* ── Kiểm tra Bill ── */
  function renderBillCheck() {
    const pending = [];
    const approved = [];
    state.revenuePeriods.forEach((p) => {
      if (!p.rows) return;
      p.rows.forEach((row, i) => {
        if (row.billState === "pending_kt" || row.billState === "request_bill") {
          pending.push({ p, row, i });
        } else if (row.billState === "approved" || row.billState === "exported") {
          approved.push({ p, row, i });
        }
      });
    });

    document.getElementById("billCheckStats").innerHTML = `
      <div class="stat-card"><div class="label">Chờ duyệt</div><div class="value warning">${pending.length}</div></div>
      <div class="stat-card"><div class="label">Đã duyệt</div><div class="value success">${approved.length}</div></div>
      <div class="stat-card"><div class="label">Kỳ đã mở</div><div class="value">${state.revenuePeriods.filter((p) => p.opened).length}</div></div>
    `;

    const list = document.getElementById("billCheckList");
    if (!pending.length && !approved.length) {
      list.innerHTML = `<div class="empty-state"><div class="emoji">✅</div>Không có bill chờ duyệt.<p style="margin-top:0.5rem;font-size:0.85rem">Khi quản lý bấm «Yêu cầu lập bill», phiếu sẽ hiện tại đây.</p></div>`;
      return;
    }

    let html = "";
    if (pending.length) {
      html += `<div class="card" style="margin-bottom:1rem"><div class="card-header"><h3>Chờ KT duyệt (${pending.length})</h3></div>
        <div class="card-body">${pending
          .map(({ p, row, i }) => {
            recalcBillRow(row);
            return `
            <div class="bill-check-card">
              <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;align-items:center">
                <div>
                  <strong>P.${row.roomId}</strong> · Kỳ ${p.label} · ${esc(row.tenantName)}
                  <div style="margin-top:0.25rem">${billStateBadge(row.billState)}</div>
                </div>
                <div class="money" style="font-size:1.1rem;font-weight:700">${fmtMoney(row.total)}</div>
              </div>
              <div class="bill-breakdown">
                <span>Phòng ${fmtMoney(row.rent)}</span>
                <span>Điện ${fmtMoney(row.electric)}</span>
                <span>Nước ${fmtMoney(row.water)}</span>
                <span>Xe ${fmtMoney(row.vehicleFee)}</span>
                <span>DV ${fmtMoney(row.serviceFee)}</span>
                <span>PS ${fmtMoney(row.extra)}</span>
                <span>Thiếu/Dư ${fmtMoney(row.balancePrev)}</span>
                <span>CK ${fmtMoney(row.paidCk)}</span>
              </div>
              <div class="action-row">
                <button class="btn btn-sm btn-primary" onclick="App.approveBill('${p.id}',${i})">Xác nhận bill</button>
                <button class="btn btn-sm" onclick="App.showBillPdfModal('${p.id}',${i})">Xem breakdown</button>
              </div>
            </div>`;
          })
          .join("")}</div></div>`;
    }
    if (approved.length) {
      html += `<div class="card"><div class="card-header"><h3>Đã duyệt gần đây</h3></div>
        <div class="card-body table-wrap"><table>
          <thead><tr><th>Kỳ</th><th>Phòng</th><th>Khách</th><th>Tổng</th><th>TT</th><th></th></tr></thead>
          <tbody>${approved
            .slice(-20)
            .reverse()
            .map(
              ({ p, row, i }) => `
            <tr>
              <td>${p.label}</td><td>${row.roomId}</td><td>${esc(row.tenantName)}</td>
              <td class="money">${fmtMoney(row.total)}</td>
              <td>${billStateBadge(row.billState)}</td>
              <td><button class="btn btn-xs" onclick="App.showBillPdfModal('${p.id}',${i})">Bill</button></td>
            </tr>`
            )
            .join("")}</tbody></table></div></div>`;
    }
    list.innerHTML = html;
  }

  function approveBill(periodId, rowIdx) {
    const p = state.revenuePeriods.find((x) => x.id === periodId);
    if (!p || !p.rows[rowIdx]) return;
    p.rows[rowIdx].billState = "approved";
    const allApproved = p.rows.every((r) => r.billState === "approved" || r.billState === "exported");
    if (allApproved) p.approved = true;
    saveState();
    toast("KT đã duyệt bill P." + p.rows[rowIdx].roomId, "success");
    renderBillCheck();
  }

  /* ── Báo cáo ── */
  function renderReport() {
    const report = state.monthlyReport || [];
    const last = report[report.length - 1] || {
      rent: 0, electric: 0, water: 0, service: 0, vehicle: 0, extra: 0,
    };
    const lastTotal =
      last.rent + last.electric + last.water + last.service + last.vehicle + last.extra;
    const occupied = state.rooms.filter((r) => r.status === "renting" || r.status === "deposit_hold").length;
    const fillRate = state.rooms.length ? Math.round((occupied / state.rooms.length) * 100) : 0;
    const dep = totalDepositHeld();

    document.getElementById("reportTiles").innerHTML = `
      <div class="stat-card"><div class="label">Doanh thu tháng gần nhất</div><div class="value primary money">${fmtMoney(lastTotal)}</div></div>
      <div class="stat-card"><div class="label">Tỷ lệ lấp đầy</div><div class="value success">${fillRate}%</div></div>
      <div class="stat-card"><div class="label">Cọc đang giữ</div><div class="value money">${fmtMoney(dep)}</div></div>
      <div class="stat-card"><div class="label">Phòng trống</div><div class="value danger">${state.rooms.filter((r) => r.status === "vacant").length}</div></div>
    `;

    const maxBar = Math.max(
      ...report.map((m) => m.rent + m.electric + m.water + m.service + m.vehicle + m.extra),
      1
    );
    document.getElementById("barChart").innerHTML = `
      <div class="bar-chart">
        ${report
          .map((m) => {
            const t = m.rent + m.electric + m.water + m.service + m.vehicle + m.extra;
            const h = Math.round((t / maxBar) * 140);
            return `<div class="bar-col" title="${m.month}: ${fmtMoney(t)}">
              <div class="bar" style="height:${h}px"></div>
              <div class="bar-label">${m.month.replace("/2026", "")}</div>
              <div class="bar-val">${Math.round(t / 1000000)}tr</div>
            </div>`;
          })
          .join("")}
      </div>`;

    const parts = [
      ["Thuê", last.rent, "#6D28D9"],
      ["Điện", last.electric, "#F59E0B"],
      ["Nước", last.water, "#0EA5E9"],
      ["DV", last.service, "#10B981"],
      ["Xe", last.vehicle, "#8B5CF6"],
      ["PS", last.extra, "#EF4444"],
    ];
    let acc = 0;
    const circles = parts
      .map(([label, val, color]) => {
        const pct = lastTotal ? (val / lastTotal) * 100 : 0;
        const dash = pct + " " + (100 - pct);
        const rot = acc * 3.6;
        acc += pct;
        return `<circle class="donut-seg" r="15.915" cx="18" cy="18" stroke="${color}" stroke-dasharray="${dash}" stroke-dashoffset="0" transform="rotate(${rot} 18 18)"></circle>`;
      })
      .join("");
    document.getElementById("donutChart").innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 36 36" class="donut-svg">
          <circle r="15.915" cx="18" cy="18" fill="transparent" stroke="#E2E8F0" stroke-width="3.5"></circle>
          ${circles}
        </svg>
        <div class="donut-legend">
          ${parts
            .map(
              ([label, val, color]) =>
                `<div class="donut-leg-item"><span class="swatch" style="background:${color}"></span>${label}: <strong class="money">${fmtMoney(val)}</strong></div>`
            )
            .join("")}
        </div>
      </div>`;

    const mustCollect = lastTotal;
    const collected = Math.round(mustCollect * 0.82);
    document.getElementById("reportBuildingRows").innerHTML = `
      <tr>
        <td><strong>${esc(state.building.name)} (${esc(state.building.code)})</strong></td>
        <td>${fillRate}%</td>
        <td class="money">${fmtMoney(mustCollect)}</td>
        <td class="money">${fmtMoney(collected)}</td>
        <td class="money">${fmtMoney(mustCollect - collected)}</td>
        <td>82%</td>
        <td class="money">${fmtMoney(dep)}</td>
      </tr>
      <tr style="opacity:0.55">
        <td>Tòa nhà 316A (stub)</td>
        <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
      </tr>`;
  }

  /* ── Customers ── */
  function renderCustomers() {
    const tbody = document.getElementById("customerTable");
    const living = state.tenants.filter((t) => t.active !== false).length;
    const movedOut = state.tenants.filter((t) => t.active === false).length;
    const statsEl = document.getElementById("customerStats");
    if (statsEl) {
      const livingActive = customerFilter === "living" ? " active" : "";
      const movedActive = customerFilter === "moved" ? " active" : "";
      statsEl.innerHTML = `
        <button type="button" class="stat-card clickable${livingActive}" onclick="App.setCustomerFilter('living')" aria-pressed="${customerFilter === "living"}">
          <div class="label">Khách đang ở trong tòa nhà</div>
          <div class="value success">${living}</div>
        </button>
        <button type="button" class="stat-card clickable${movedActive}" onclick="App.setCustomerFilter('moved')" aria-pressed="${customerFilter === "moved"}">
          <div class="label">Khách đã chuyển ra</div>
          <div class="value danger">${movedOut}</div>
        </button>`;
    }
    let list = state.tenants.slice();
    if (customerFilter === "living") list = list.filter((t) => t.active !== false);
    else if (customerFilter === "moved") list = list.filter((t) => t.active === false);
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:1.5rem">Không có khách trong bộ lọc này</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((t, i) => {
        const role = t.role === "chu" ? "Chủ HĐ" : t.role === "ocung" ? "Ở cùng" : "—";
        const active = t.active !== false;
        return `
        <tr class="${active ? "" : "deleted-row"}">
          <td>${i + 1}</td>
          <td><strong>${esc(t.name)}</strong></td>
          <td>${esc(t.gender || "—")}</td>
          <td>${esc(t.phone || "—")}</td>
          <td>${esc(t.cccd || "—")}</td>
          <td>${t.dob ? fmtDate(t.dob) : "—"}</td>
          <td>${t.roomId || "—"}</td>
          <td>${role}</td>
          <td>${active ? '<span class="badge badge-success">Đang ở</span>' : '<span class="badge badge-danger">Chuyển ra</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-xs" onclick="App.openCustomerModal('${t.id}')">Sửa</button>
            ${active ? `<button class="btn btn-xs btn-danger" onclick="App.softDeleteCustomer('${t.id}')">Chuyển ra</button>` : ""}
          </td>
        </tr>`;
      })
      .join("");
  }

  function setCustomerFilter(key) {
    // click same filter again → show all; otherwise apply filter
    if (customerFilter === key) customerFilter = "all";
    else customerFilter = key;
    renderCustomers();
  }

  function openCustomerModal(id) {
    editingCustomerId = id || null;
    const t = id ? tenantById(id) : null;
    const roomOpts = state.rooms
      .map((r) => `<option value="${r.id}" ${t && t.roomId === r.id ? "selected" : ""}>${r.label}</option>`)
      .join("");
    openModal(
      t ? "Sửa khách hàng" : "Thêm khách hàng",
      `
      <div class="form-group"><label>Họ tên *</label>
        <input id="f-name" value="${t ? esc(t.name) : ""}" placeholder="Nguyễn Văn A" /></div>
      <div class="form-row">
        <div class="form-group"><label>Giới tính</label>
          <select id="f-gender">
            <option value="Nam" ${t && t.gender === "Nam" ? "selected" : ""}>Nam</option>
            <option value="Nữ" ${t && t.gender === "Nữ" ? "selected" : ""}>Nữ</option>
          </select></div>
        <div class="form-group"><label>Phòng</label>
          <select id="f-room"><option value="">—</option>${roomOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>SĐT</label>
          <input id="f-phone" value="${t ? esc(t.phone || "") : ""}" /></div>
        <div class="form-group"><label>CCCD</label>
          <input id="f-cccd" value="${t ? esc(t.cccd || "") : ""}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ngày sinh</label>
          <input type="date" id="f-dob" value="${t ? t.dob || "" : ""}" /></div>
        <div class="form-group"><label>Vai trò</label>
          <select id="f-role">
            <option value="chu" ${!t || t.role === "chu" ? "selected" : ""}>Chủ HĐ</option>
            <option value="ocung" ${t && t.role === "ocung" ? "selected" : ""}>Ở cùng</option>
          </select></div>
      </div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveCustomer()">Lưu</button>`
    );
  }

  function saveCustomer() {
    const name = document.getElementById("f-name").value.trim();
    if (!name) {
      toast("Vui lòng nhập họ tên", "error");
      return;
    }
    const data = {
      name,
      gender: document.getElementById("f-gender").value,
      phone: document.getElementById("f-phone").value.trim(),
      cccd: document.getElementById("f-cccd").value.trim(),
      dob: document.getElementById("f-dob").value,
      roomId: document.getElementById("f-room").value || null,
      role: document.getElementById("f-role").value,
      active: true,
    };
    if (editingCustomerId) {
      const t = tenantById(editingCustomerId);
      Object.assign(t, data);
      toast("Đã cập nhật khách hàng", "success");
    } else {
      state.tenants.push({ id: uid("t"), ...data });
      toast("Đã thêm khách hàng", "success");
    }
    saveState();
    closeModal();
    renderCustomers();
    if (currentRoomId) openRoom(currentRoomId);
  }

  function softDeleteCustomer(id) {
    const t = tenantById(id);
    if (!t) return;
    if (!confirm("Xác nhận khách «" + t.name + "» chuyển ra?")) return;
    t.active = false;
    saveState();
    toast("Đã đánh dấu khách chuyển ra", "success");
    renderCustomers();
  }

  /* ── Vehicles ── */
  function filterVehicles(q) {
    vehicleQuery = q || "";
    renderVehicles();
  }

  function renderVehicles() {
    const grid = document.getElementById("vehicleGrid");
    const q = normalizePlate(vehicleQuery);
    let list = state.vehicles;
    if (q) list = list.filter((v) => normalizePlate(v.plate).includes(q));
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state"><div class="emoji">🛵</div>${q ? "Không tìm thấy biển số khớp" : "Chưa có xe đăng ký"}</div>`;
      return;
    }
    const icons = { "Xe máy": "🛵", "Ô tô": "🚗", Khác: "🚲" };
    const plateCounts = {};
    state.vehicles.forEach((v) => {
      const n = normalizePlate(v.plate);
      plateCounts[n] = (plateCounts[n] || 0) + 1;
    });
    grid.innerHTML = list
      .map((v) => {
        const owner = tenantById(v.tenantId);
        const dup = plateCounts[normalizePlate(v.plate)] > 1;
        return `
        <div class="vehicle-card ${dup ? "dup-warn" : ""}">
          <div class="vehicle-photo">${icons[v.type] || "🚲"}</div>
          <div class="body">
            <div class="plate">${esc(v.plate)}${dup ? ' <span class="badge badge-warning">Trùng biển</span>' : ""}</div>
            <div class="meta">${esc(v.type)} · Phòng ${esc(v.roomId || "—")}</div>
            <div class="meta">Chủ xe: ${owner ? esc(owner.name) : "—"}</div>
            <div style="margin-top:0.6rem;display:flex;gap:0.35rem">
              <button class="btn btn-xs" onclick="App.openVehicleModal('${v.id}')">Sửa</button>
              <button class="btn btn-xs btn-danger" onclick="App.deleteVehicle('${v.id}')">Xóa</button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  function openVehicleModal(id) {
    editingVehicleId = id || null;
    const v = id ? state.vehicles.find((x) => x.id === id) : null;
    const activeTenants = state.tenants.filter((t) => t.active !== false);
    const tenantOpts = activeTenants
      .map(
        (t) =>
          `<option value="${t.id}" ${v && v.tenantId === t.id ? "selected" : ""}>${esc(t.name)} (P.${t.roomId || "—"})</option>`
      )
      .join("");
    openModal(
      v ? "Sửa xe" : "Thêm xe",
      `
      <div class="form-group"><label>Biển số *</label>
        <input id="f-plate" value="${v ? esc(v.plate) : ""}" placeholder="59A-12345" oninput="App.checkPlateDup(this.value)" /></div>
      <div id="plateDupWarn" style="display:none;color:var(--warning);font-size:0.8rem;margin-top:-0.4rem;margin-bottom:0.5rem"></div>
      <div class="form-group"><label>Loại xe</label>
        <select id="f-vtype">
          <option ${v && v.type === "Xe máy" ? "selected" : ""}>Xe máy</option>
          <option ${v && v.type === "Ô tô" ? "selected" : ""}>Ô tô</option>
          <option ${v && v.type === "Khác" ? "selected" : ""}>Khác</option>
        </select></div>
      <div class="form-group"><label>Chủ xe (khách thuê) *</label>
        <select id="f-vtenant"><option value="">— Chọn —</option>${tenantOpts}</select></div>
      <div class="form-group"><label>Ảnh xe</label>
        <div style="padding:1.5rem;background:var(--primary-bg);border-radius:8px;text-align:center;color:var(--text-muted);font-size:0.85rem">
          📷 Placeholder — tải ảnh (demo, chưa lưu file)
        </div></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveVehicle()">Lưu</button>`
    );
    if (v) checkPlateDup(v.plate);
  }

  function checkPlateDup(plate) {
    const el = document.getElementById("plateDupWarn");
    if (!el) return;
    const n = normalizePlate(plate);
    if (!n) {
      el.style.display = "none";
      return;
    }
    const dups = state.vehicles.filter(
      (v) => normalizePlate(v.plate) === n && v.id !== editingVehicleId
    );
    if (dups.length) {
      el.style.display = "block";
      el.textContent = "⚠ Biển số đã tồn tại (" + dups.length + " xe) — vẫn cho lưu (cảnh báo).";
    } else {
      el.style.display = "none";
    }
  }

  function saveVehicle() {
    const plate = document.getElementById("f-plate").value.trim();
    const tenantId = document.getElementById("f-vtenant").value;
    if (!plate || !tenantId) {
      toast("Nhập biển số và chọn chủ xe", "error");
      return;
    }
    const owner = tenantById(tenantId);
    const data = {
      plate,
      type: document.getElementById("f-vtype").value,
      tenantId,
      roomId: owner ? owner.roomId : null,
      photo: null,
    };
    const n = normalizePlate(plate);
    const dups = state.vehicles.filter(
      (v) => normalizePlate(v.plate) === n && v.id !== editingVehicleId
    );
    if (editingVehicleId) {
      const v = state.vehicles.find((x) => x.id === editingVehicleId);
      Object.assign(v, data);
      toast(dups.length ? "Đã cập nhật xe (cảnh báo trùng biển)" : "Đã cập nhật xe", dups.length ? "info" : "success");
    } else {
      state.vehicles.push({ id: uid("v"), ...data });
      toast(dups.length ? "Đã thêm xe (cảnh báo trùng biển)" : "Đã thêm xe", dups.length ? "info" : "success");
    }
    saveState();
    closeModal();
    renderVehicles();
  }

  function deleteVehicle(id) {
    if (!confirm("Xóa xe này?")) return;
    state.vehicles = state.vehicles.filter((v) => v.id !== id);
    saveState();
    toast("Đã xóa xe", "success");
    renderVehicles();
  }

  /* ── Building config ── */
  function renderBuildingConfig() {
    const b = state.building;
    document.getElementById("buildingConfigForm").innerHTML = `
      <div class="form-row">
        <div class="form-group"><label>Tên thương mại</label><input id="cfg-name" value="${esc(b.name)}" /></div>
        <div class="form-group"><label>Mã tòa</label><input id="cfg-code" value="${esc(b.code)}" /></div>
      </div>
      <div class="form-group"><label>Địa chỉ</label><input id="cfg-address" value="${esc(b.address)}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Khu vực</label><input id="cfg-area" value="${esc(b.area)}" /></div>
        <div class="form-group"><label>Quản lý</label><input id="cfg-manager" value="${esc(b.manager)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Số tầng</label><input type="number" id="cfg-floors" value="${b.floors || 6}" /></div>
        <div class="form-group"><label>Alias tầng</label><input id="cfg-floorAlias" value="${esc(b.floorAlias || "")}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Giá tham khảo</label><input type="number" id="cfg-consult" value="${b.consultPrice || 0}" /></div>
        <div class="form-group"><label>Ngày thu</label><input id="cfg-collectDay" value="${esc(b.collectDay || "")}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Đơn giá điện</label><input type="number" id="cfg-elec" value="${b.electricRate || 3500}" /></div>
        <div class="form-group"><label>Đơn giá nước</label><input type="number" id="cfg-water" value="${b.waterRate || 20000}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Phí DV</label><input type="number" id="cfg-service" value="${b.serviceFee || 0}" /></div>
        <div class="form-group"><label>Phí xe</label><input type="number" id="cfg-vehicle" value="${b.vehicleFee || 0}" /></div>
      </div>
      <div class="form-group"><label>Cách tính nước</label>
        <select id="cfg-waterCalc">
          <option value="đầu người" ${b.waterCalc === "đầu người" ? "selected" : ""}>Đầu người</option>
          <option value="đồng hồ" ${b.waterCalc === "đồng hồ" ? "selected" : ""}>Đồng hồ</option>
        </select></div>
      <div class="form-row">
        <div class="form-group"><label>STK</label><input id="cfg-bankAccount" value="${esc(b.bankAccount || "")}" /></div>
        <div class="form-group"><label>Ngân hàng</label><input id="cfg-bankName" value="${esc(b.bankName || "")}" /></div>
      </div>
      <div class="form-group"><label>Chủ TK</label><input id="cfg-bankHolder" value="${esc(b.bankHolder || "")}" /></div>
      <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="App.saveBuildingConfig()">💾 Lưu cấu hình</button>
        <button class="btn btn-danger" onclick="App.resetData()">↺ Reset dữ liệu mẫu</button>
      </div>`;
  }

  function saveBuildingConfig() {
    const b = state.building;
    b.name = document.getElementById("cfg-name").value.trim() || b.name;
    b.code = document.getElementById("cfg-code").value.trim() || b.code;
    b.address = document.getElementById("cfg-address").value.trim();
    b.area = document.getElementById("cfg-area").value.trim();
    b.manager = document.getElementById("cfg-manager").value.trim();
    b.floors = Number(document.getElementById("cfg-floors").value) || b.floors;
    b.floorAlias = document.getElementById("cfg-floorAlias").value.trim();
    b.consultPrice = Number(document.getElementById("cfg-consult").value) || 0;
    b.collectDay = document.getElementById("cfg-collectDay").value.trim();
    b.electricRate = Number(document.getElementById("cfg-elec").value) || 3500;
    b.waterRate = Number(document.getElementById("cfg-water").value) || 20000;
    b.serviceFee = Number(document.getElementById("cfg-service").value) || 0;
    b.vehicleFee = Number(document.getElementById("cfg-vehicle").value) || 0;
    b.waterCalc = document.getElementById("cfg-waterCalc").value;
    b.bankAccount = document.getElementById("cfg-bankAccount").value.trim();
    b.bankName = document.getElementById("cfg-bankName").value.trim();
    b.bankHolder = document.getElementById("cfg-bankHolder").value.trim();
    saveState();
    const sub = document.getElementById("sidebarBuilding");
    if (sub) sub.textContent = "Tòa nhà " + b.code;
    toast("Đã lưu cấu hình tòa", "success");
  }

  function resetData() {
    if (!confirm("Reset toàn bộ dữ liệu về seed v3? localStorage sẽ bị xóa.")) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      localStorage.removeItem("baro-house-316-v1");
      localStorage.removeItem("baro-house-v2");
    } catch (_) {}
    bootFromSeed();
    shellView = "home";
    currentAreaId = "kv1";
    currentBuilding = "316";
    goHome();
    toast("Đã reset seed v3", "success");
  }

  function openAddRoomModal() {
    openModal(
      "Thêm phòng",
      `
      <div class="form-row">
        <div class="form-group"><label>Mã phòng *</label><input id="f-rid" placeholder="106" /></div>
        <div class="form-group"><label>Tầng</label>
          <select id="f-rfloor"><option>G</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
        </div>
      </div>
      <div class="form-group"><label>Giá thuê đề xuất (đ)</label><input type="number" id="f-rrent" value="${state.building.consultPrice || 4000000}" /></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveNewRoom()">Thêm</button>`
    );
  }

  function saveNewRoom() {
    const id = document.getElementById("f-rid").value.trim().toUpperCase();
    if (!id) { toast("Nhập mã phòng", "error"); return; }
    if (roomById(id)) { toast("Phòng đã tồn tại", "error"); return; }
    state.rooms.push({
      id,
      floor: document.getElementById("f-rfloor").value,
      label: id,
      status: "vacant",
      badge: null,
      rent: Number(document.getElementById("f-rrent").value) || 0,
    });
    saveState();
    closeModal();
    toast("Đã thêm phòng " + id, "success");
    renderRooms();
  }

  function editRoom(roomId) {
    const r = roomById(roomId);
    if (!r) return;
    openModal(
      "Sửa phòng " + r.label,
      `
      <div class="form-group"><label>Giá thuê</label><input type="number" id="f-edit-rent" value="${r.rent || 0}" /></div>
      <div class="form-group"><label>Trạng thái</label>
        <select id="f-edit-status">
          ${["vacant", "renting", "deposit_hold", "maintenance"]
            .map((s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${statusLabel(s)}</option>`)
            .join("")}
        </select></div>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveEditRoom('${roomId}')">Lưu</button>`
    );
  }

  function saveEditRoom(roomId) {
    const r = roomById(roomId);
    if (!r) return;
    r.rent = Number(document.getElementById("f-edit-rent").value) || 0;
    r.status = document.getElementById("f-edit-status").value;
    if (r.status === "vacant") r.badge = null;
    saveState();
    closeModal();
    toast("Đã cập nhật phòng " + roomId, "success");
    renderRooms();
    openRoom(roomId);
  }

  function editAssets(roomId) {
    const assets = state.assets[roomId] || [];
    const names = assets.map((a) => (typeof a === "string" ? a : a.name)).join("\n");
    openModal(
      "Tài sản phòng " + roomId,
      `<div class="form-group"><label>Danh sách tài sản (mỗi dòng một mục)</label>
        <textarea id="f-assets" rows="8">${esc(names)}</textarea></div>
       <p style="font-size:0.8rem;color:var(--text-muted)">Mỗi mục sẽ có 1 ảnh placeholder.</p>`,
      `<button class="btn" onclick="App.closeModal()">Hủy</button>
       <button class="btn btn-primary" onclick="App.saveAssets('${roomId}')">Lưu</button>`
    );
  }

  function saveAssets(roomId) {
    const lines = document
      .getElementById("f-assets")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const existing = state.assets[roomId] || [];
    state.assets[roomId] = lines.map((name) => {
      const old = existing.find((a) => (typeof a === "string" ? a : a.name) === name);
      if (old && typeof old === "object") return Object.assign({}, old, { name: name });
      return { id: uid("a"), name: name, photos: ["📷"] };
    });
    saveState();
    closeModal();
    toast("Đã lưu tài sản phòng " + roomId, "success");
    if (currentRoomId === roomId) openRoom(roomId);
  }

  /* ── CSV ── */
  function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsvBuilding() {
    const b = state.building;
    const headers = [
      "name","code","address","area","manager","floors","electricRate","waterRate",
      "serviceFee","vehicleFee","bankAccount","bankName","bankHolder",
    ];
    const row = headers.map((h) => JSON.stringify(b[h] == null ? "" : String(b[h]))).join(",");
    downloadCsv("baro-building-" + b.code + ".csv", headers.join(",") + "\n" + row + "\n");
    toast("Đã xuất CSV tòa", "success");
  }

  function exportCsvRooms() {
    const headers = ["id", "floor", "label", "status", "badge", "rent"];
    const lines = [headers.join(",")];
    state.rooms.forEach((r) => {
      lines.push(headers.map((h) => JSON.stringify(r[h] == null ? "" : String(r[h]))).join(","));
    });
    downloadCsv("baro-rooms-" + state.building.code + ".csv", lines.join("\n") + "\n");
    toast("Đã xuất CSV " + state.rooms.length + " phòng", "success");
  }

  function importCsv(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result || "");
      const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (l) { return l.trim(); });
      const header = lines[0] || "";
      const count = Math.max(0, lines.length - 1);
      toast(
        "Import CSV «" + file.name + "»: header=[" + header.slice(0, 60) + (header.length > 60 ? "…" : "") + "] · " + count + " dòng dữ liệu (demo, chưa ghi đè state)",
        "info"
      );
      event.target.value = "";
    };
    reader.onerror = function () { toast("Không đọc được file", "error"); };
    reader.readAsText(file);
  }

  function changeBuilding(code) {
    if (!code) return;
    enterBuilding(code);
  }

  /* ── Init + export ── */
  function init() {
    loadState();

    document.getElementById("nav").addEventListener("click", function (e) {
      const btn = e.target.closest(".nav-item");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("menuToggle").addEventListener("click", openSidebar);
    document.getElementById("sidebarBackdrop").addEventListener("click", closeSidebar);
    document.getElementById("panelClose").addEventListener("click", closePanel);
    document.getElementById("panelOverlay").addEventListener("click", closePanel);
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalBackdrop").addEventListener("click", closeModal);

    const btnBack = document.getElementById("btnBack");
    if (btnBack) btnBack.addEventListener("click", goBack);

    const subTabs = document.getElementById("roomsSubTabs");
    if (subTabs) {
      subTabs.addEventListener("click", function (e) {
        const btn = e.target.closest(".sub-tab");
        if (btn) setRoomsSub(btn.dataset.sub);
      });
    }

    const bsel = document.getElementById("buildingSelect");
    if (bsel) {
      bsel.addEventListener("change", function () { changeBuilding(bsel.value); });
    }

    goHome();
  }

  window.App = {
    setCustomerFilter,
    goHome,
    goArea,
    goBack,
    goEmployees,
    goCeoReport,
    promptCreateArea,
    openCreateBuildingModal,
    saveNewBuilding,
    enterBuilding,

    switchTab: switchTab,
    setRoomFilter: setRoomFilter,
    setRoomsSub: setRoomsSub,
    openRoom: openRoom,
    closeModal: closeModal,
    openContractModal: openContractModal,
    openDepositContractModal: openDepositContractModal,
    saveNewContract: saveNewContract,
    saveDepositContract: saveDepositContract,
    editContract: editContract,
    saveEditContract: saveEditContract,
    lockContract: lockContract,
    confirmDeposit: confirmDeposit,
    convertDepositToRent: convertDepositToRent,
    openRenewModal: openRenewModal,
    saveRenew: saveRenew,
    openLiquidateModal: openLiquidateModal,
    saveLiquidate: saveLiquidate,
    openAddRoomModal: openAddRoomModal,
    saveNewRoom: saveNewRoom,
    editRoom: editRoom,
    saveEditRoom: saveEditRoom,
    openCustomerModal: openCustomerModal,
    saveCustomer: saveCustomer,
    softDeleteCustomer: softDeleteCustomer,
    openVehicleModal: openVehicleModal,
    saveVehicle: saveVehicle,
    deleteVehicle: deleteVehicle,
    filterVehicles: filterVehicles,
    checkPlateDup: checkPlateDup,
    openPeriod: openPeriod,
    updatePeriodRow: updatePeriodRow,
    savePeriod: savePeriod,
    requestBill: requestBill,
    requestAllBills: requestAllBills,
    showBillPdfModal: showBillPdfModal,
    approveBill: approveBill,
    renderBuildingConfig: renderBuildingConfig,
    saveBuildingConfig: saveBuildingConfig,
    resetData: resetData,
    editAssets: editAssets,
    saveAssets: saveAssets,
    editSingleAsset: editSingleAsset,
    saveSingleAsset: saveSingleAsset,
    deleteAsset: deleteAsset,
    moveAssetToWarehouse: moveAssetToWarehouse,
    moveWarehouseToRoom: moveWarehouseToRoom,
    confirmMoveToRoom: confirmMoveToRoom,
    openAddWarehouseAsset: openAddWarehouseAsset,
    saveWarehouseAsset: saveWarehouseAsset,
    exportCsvBuilding: exportCsvBuilding,
    exportCsvRooms: exportCsvRooms,
    importCsv: importCsv,
    mockAction: mockAction,
    mockPdf: mockPdf,
    changeBuilding: changeBuilding,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
