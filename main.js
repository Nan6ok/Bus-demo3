// 初始化地圖
const map = L.map('map').setView([22.302711, 114.177216], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// 時鐘
function updateClock() {
  const now = new Date();
  document.getElementById('clock').innerText =
    now.toLocaleTimeString('zh-HK', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// 九巴 API 基本網址
const API_BASE = "https://data.etabus.gov.hk/v1/transport/kmb";

// 當前路線 / 方向
let currentRoute = null;
let direction = "inbound"; // inbound=入城, outbound=出城

// 載入所有路線到下拉選單
async function loadRoutes() {
  const res = await fetch(`${API_BASE}/route`);
  const data = await res.json();
  const routes = data.data;

  const select = document.getElementById("routeSelect");
  select.innerHTML = "";
  routes.slice(0, 100).forEach(r => { // 減少數量方便示範 (前100條)
    const opt = document.createElement("option");
    opt.value = r.route;
    opt.textContent = r.route;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    currentRoute = select.value;
    loadRouteStops();
  });
}

// 切換方向
document.getElementById("dirBtn").addEventListener("click", () => {
  direction = direction === "inbound" ? "outbound" : "inbound";
  if (currentRoute) loadRouteStops();
});

// 載入站點 + ETA
async function loadRouteStops() {
  if (!currentRoute) return;

  const stopListEl = document.getElementById("stopList");
  stopListEl.innerHTML = "<li>載入中...</li>";

  try {
    const resStops = await fetch(`${API_BASE}/route-stop/${currentRoute}/${direction}/1`);
    const dataStops = await resStops.json();
    const stopsData = dataStops.data;

    // 清除地圖
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // 畫路線
    let coords = [];
    for (const s of stopsData) {
      const stopInfoRes = await fetch(`${API_BASE}/stop/${s.stop}`);
      const stopInfo = await stopInfoRes.json();
      const { lat, long, name_tc, name_en } = stopInfo.data;
      coords.push([lat, long]);

      const marker = L.marker([lat, long]).addTo(map);
      marker.bindPopup(`${name_tc}<br>${name_en}`);
    }
    if (coords.length > 0) {
      const poly = L.polyline(coords, { color: "blue", weight: 4 }).addTo(map);
      map.fitBounds(poly.getBounds());
    }

    // 更新 ETA
    const resETA = await fetch(`${API_BASE}/eta/${currentRoute}/${direction}/1`);
    const dataETA = await resETA.json();
    const etaMap = {};
    dataETA.data.forEach(e => {
      if (!etaMap[e.stop]) etaMap[e.stop] = [];
      etaMap[e.stop].push(e.eta);
    });

    stopListEl.innerHTML = "";
    for (const s of stopsData) {
      const stopInfoRes = await fetch(`${API_BASE}/stop/${s.stop}`);
      const stopInfo = await stopInfoRes.json();
      const { name_tc, name_en } = stopInfo.data;

      const li = document.createElement("li");
      li.textContent = `${name_tc} / ${name_en}`;

      const span = document.createElement("span");
      span.classList.add("eta");

      if (etaMap[s.stop] && etaMap[s.stop].length > 0) {
        const nextBus = new Date(etaMap[s.stop][0]);
        const now = new Date();
        const diffMin = Math.max(0, Math.floor((nextBus - now) / 60000));
        span.textContent = diffMin + " 分鐘";
      } else {
        span.textContent = "暫無班次";
      }

      li.appendChild(span);
      stopListEl.appendChild(li);
    }

  } catch (err) {
    console.error("載入失敗:", err);
    document.getElementById("stopList").innerHTML = "<li>載入失敗</li>";
  }
}

// 初始化
loadRoutes();
