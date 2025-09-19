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

const API_BASE = "https://data.etabus.gov.hk/v1/transport/kmb";
let currentRoute = null;
let direction = "inbound"; // inbound=入城, outbound=出城
let stopCoords = [];
let busMarker = null;
let busIndex = 0;

// 載入所有路線
async function loadRoutes() {
  const res = await fetch(`${API_BASE}/route`);
  const data = await res.json();
  const routes = data.data;

  const select = document.getElementById("routeSelect");
  select.innerHTML = "";
  routes.slice(0, 100).forEach(r => {
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

    // 清地圖
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    stopCoords = [];
    for (const s of stopsData) {
      const stopInfoRes = await fetch(`${API_BASE}/stop/${s.stop}`);
      const stopInfo = await stopInfoRes.json();
      const { lat, long, name_tc, name_en } = stopInfo.data;
      stopCoords.push([lat, long]);

      const marker = L.marker([lat, long]).addTo(map);
      marker.bindPopup(`${name_tc}<br>${name_en}`);
    }
    if (stopCoords.length > 0) {
      const poly = L.polyline(stopCoords, { color: "blue", weight: 4 }).addTo(map);
      map.fitBounds(poly.getBounds());
    }

    // ETA
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

    // 動態巴士
    if (busMarker) map.removeLayer(busMarker);
    if (stopCoords.length > 0) {
      busIndex = 0;
      busMarker = L.marker(stopCoords[0], {
        icon: L.divIcon({
          className: "bus-icon",
          html: "🚌",
          iconSize: [30, 30]
        })
      }).addTo(map);

      animateBus();
    }

  } catch (err) {
    console.error("載入失敗:", err);
    document.getElementById("stopList").innerHTML = "<li>載入失敗</li>";
  }
}

// 動態巴士行駛動畫
function animateBus() {
  if (!busMarker || stopCoords.length < 2) return;

  let nextIndex = (busIndex + 1) % stopCoords.length;
  let currentPos = L.latLng(stopCoords[busIndex]);
  let nextPos = L.latLng(stopCoords[nextIndex]);
  let step = 0;
  let steps = 100;

  function move() {
    step++;
    const lat = currentPos.lat + (nextPos.lat - currentPos.lat) * (step / steps);
    const lng = currentPos.lng + (nextPos.lng - currentPos.lng) * (step / steps);
    busMarker.setLatLng([lat, lng]);

    if (step < steps) {
      requestAnimationFrame(move);
    } else {
      busIndex = nextIndex;
      setTimeout(animateBus, 500);
    }
  }
  move();
}

loadRoutes();
