const BUKGU_CENTER = [35.92, 128.58];

const GRADE_COLORS = {
  A: "#d73027",
  B: "#fc8d59",
  C: "#fee08b",
  D: "#91cf60",
  default: "#cccccc"
};

let map;
let regionLayer;
let cctvLayer;
let hotspotLayer;

let regionData = [];
let regionDataMap = {};
let geoRegionLayers = {};

function initMap() {
  map = L.map("map", {
    center: BUKGU_CENTER,
    zoom: 12,
    minZoom: 11,
    maxZoom: 18
  });

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(map);

  regionLayer = L.layerGroup().addTo(map);
  cctvLayer = L.layerGroup();
  hotspotLayer = L.layerGroup();

  L.control.layers(
    null,
    {
      "관리 우선도": regionLayer,
      "CCTV": cctvLayer,
      "상습 민원지역": hotspotLayer
    },
    {
      collapsed: false
    }
  ).addTo(map);

  addGradeLegend();
  bindSearch();
  loadMapData();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} 요청 실패`);
  }

  return await response.json();
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return Math.round(number).toLocaleString("ko-KR");
}

function formatScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return number.toFixed(1);
}

function getGradeColor(grade) {
  return GRADE_COLORS[grade] || GRADE_COLORS.default;
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent =
    value === null || value === undefined || value === ""
      ? "-"
      : value;
}

function updateRegionPanel(region) {
  setText("region-name", region["동"]);
  setText("grade-badge", region["관리등급"]);
  setText("score", `${formatScore(region["관리점수"])}점`);
  setText(
    "violation-count",
    `${formatNumber(region["단속건수_2017_2023"])}건`
  );
  setText(
    "complaint-count",
    `${formatNumber(region["민원건수_2018_2021"])}건`
  );
  setText(
    "cctv-count",
    `${formatNumber(region["CCTV수"])}대`
  );

  const hour = Number(region["집중시간"]);

  setText(
    "peak-time",
    Number.isFinite(hour) && hour >= 0
      ? `${hour}시`
      : "-"
  );

  setText(
    "peak-weekday",
    region["집중요일"] || "-"
  );

  setText(
    "management-type",
    region["관리유형"] || "-"
  );

  const badge = document.getElementById("grade-badge");

  if (badge) {
    badge.style.background = getGradeColor(region["관리등급"]);
    badge.style.color =
      region["관리등급"] === "C"
        ? "#3f3f3f"
        : "#ffffff";
  }
}

function buildRegionPopup(region) {
  return `
    <div class="region-popup">
      <h3>${region["동"]}</h3>
      <table>
        <tr><th>관리등급</th><td>${region["관리등급"]}</td></tr>
        <tr><th>관리점수</th><td>${formatScore(region["관리점수"])}점</td></tr>
        <tr><th>단속건수</th><td>${formatNumber(region["단속건수_2017_2023"])}건</td></tr>
        <tr><th>민원건수</th><td>${formatNumber(region["민원건수_2018_2021"])}건</td></tr>
        <tr><th>CCTV</th><td>${formatNumber(region["CCTV수"])}대</td></tr>
        <tr><th>집중요일</th><td>${region["집중요일"] || "-"}</td></tr>
        <tr><th>집중시간</th><td>${region["집중시간"]}시</td></tr>
      </table>
    </div>
  `;
}

async function loadRegions() {
  regionData = await fetchJson("/api/regions");
  regionDataMap = {};

  regionData.forEach(region => {
    regionDataMap[region["동"]] = region;
  });

  if (regionData.length > 0) {
    updateRegionPanel(regionData[0]);
  }
}

async function loadRanking() {
  const data = await fetchJson("/api/ranking");
  const list = document.getElementById("ranking-list");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  data.top5.forEach((region, index) => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "ranking-item";

    item.innerHTML = `
      <span class="ranking-rank">${index + 1}</span>
      <span>
        <span class="ranking-name">${region["동"]}</span>
        <span class="ranking-score">
          ${region["관리등급"]}등급 · ${formatScore(region["관리점수"])}점
        </span>
      </span>
      <span>›</span>
    `;

    item.addEventListener("click", () => {
      focusRegion(region["동"]);
    });

    list.appendChild(item);
  });
}

async function loadRegionGeoJson() {
  try {
    const response = await fetch("/static/data/bukgu_dong.geojson");

    if (!response.ok) {
      loadRegionMarkers();
      return;
    }

    const geojson = await response.json();

    regionLayer.clearLayers();

    const geoLayer = L.geoJSON(
      geojson,
      {
        style: regionStyle,
        onEachFeature: onEachRegion
      }
    );

    geoLayer.addTo(regionLayer);

    const bounds = geoLayer.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [12, 12] });
      map.setMaxBounds(bounds.pad(0.15));
    }
  } catch (error) {
    console.log("GeoJSON 없음 또는 오류 → 마커 방식 사용");
    loadRegionMarkers();
  }
}

function getFeatureDongName(feature) {
  const props = feature.properties || {};

  return (
    props["동"] ||
    props["ADM_DR_NM"] ||
    props["adm_nm"] ||
    props["EMD_KOR_NM"] ||
    props["name"] ||
    null
  );
}

function regionStyle(feature) {
  const dong = getFeatureDongName(feature);
  const region = regionDataMap[dong];
  const grade = region ? region["관리등급"] : null;

  return {
    color: "#30485d",
    weight: 1.25,
    fillColor: getGradeColor(grade),
    fillOpacity: region ? 0.6 : 0.12
  };
}

function onEachRegion(feature, layer) {
  const dong = getFeatureDongName(feature);
  const region = regionDataMap[dong];

  if (!dong) {
    return;
  }

  geoRegionLayers[dong] = layer;

  if (!region) {
    layer.bindTooltip(dong);
    return;
  }

  layer.bindTooltip(
    `${dong} · ${region["관리등급"]}등급`,
    { sticky: true }
  );

  layer.bindPopup(buildRegionPopup(region));

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 3,
      fillOpacity: 0.78
    });
  });

  layer.on("mouseout", () => {
    layer.setStyle(regionStyle(feature));
  });

  layer.on("click", () => {
    updateRegionPanel(region);
  });
}

function loadRegionMarkers() {
  regionLayer.clearLayers();

  const bounds = [];

  regionData.forEach(region => {
    const lat = Number(region["대표위도"]);
    const lng = Number(region["대표경도"]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const marker = L.circleMarker(
      [lat, lng],
      {
        radius: region["관리등급"] === "A" ? 10 : 8,
        color: "#30485d",
        weight: 1.2,
        fillColor: getGradeColor(region["관리등급"]),
        fillOpacity: 0.85
      }
    );

    marker.bindTooltip(
      `${region["동"]} · ${region["관리등급"]}등급`
    );

    marker.bindPopup(buildRegionPopup(region));

    marker.on("click", () => {
      updateRegionPanel(region);
    });

    marker.addTo(regionLayer);
    bounds.push(marker.getLatLng());
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 13
    });
  }
}

async function loadCctv() {
  const data = await fetchJson("/api/cctv");

  cctvLayer.clearLayers();

  data.forEach(item => {
    const lat = Number(item["위도"]);
    const lng = Number(item["경도"]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const marker = L.circleMarker(
      [lat, lng],
      {
        radius: 4,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.8,
        weight: 1
      }
    );

    marker.bindPopup(`
      <strong>CCTV</strong><br>
      동: ${item["동"] || "-"}<br>
      주소: ${item["주소"] || "-"}<br>
      설치목적: ${item["설치목적구분"] || "-"}
    `);

    marker.addTo(cctvLayer);
  });
}

async function loadHotspots() {
  const data = await fetchJson("/api/hotspots");

  hotspotLayer.clearLayers();

  data.forEach(item => {
    const lat = Number(item["위도"]);
    const lng = Number(item["경도"]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const count = Number(item["민원발생누적건수"]) || 0;

    const radius = Math.min(
      15,
      Math.max(5, 5 + count / 300)
    );

    const marker = L.circleMarker(
      [lat, lng],
      {
        radius,
        color: "#6d28d9",
        fillColor: "#a855f7",
        fillOpacity: 0.62,
        weight: 2
      }
    );

    marker.bindPopup(`
      <strong>상습 민원지역</strong><br>
      ${item["짧은주소"] || item["주소"] || "-"}<br>
      누적 민원: ${formatNumber(item["민원발생누적건수"])}건
    `);

    marker.addTo(hotspotLayer);
  });
}

function addGradeLegend() {
  const legend = L.control({
    position: "bottomright"
  });

  legend.onAdd = function () {
    const div = L.DomUtil.create(
      "div",
      "grade-legend"
    );

    div.innerHTML = `
      <strong>관리 우선도</strong><br>
      <span class="legend-dot grade-a"></span>A 집중관리 우선<br>
      <span class="legend-dot grade-b"></span>B 관리 강화<br>
      <span class="legend-dot grade-c"></span>C 일반 관리<br>
      <span class="legend-dot grade-d"></span>D 상대적 우선도 낮음
    `;

    return div;
  };

  legend.addTo(map);
}

function bindSearch() {
  const input = document.getElementById("region-search");
  const button = document.getElementById("search-button");

  if (!input || !button) {
    return;
  }

  button.addEventListener("click", () => {
    focusRegion(input.value.trim());
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      focusRegion(input.value.trim());
    }
  });
}

function focusRegion(dong) {
  const region = regionDataMap[dong];

  if (!region) {
    alert("해당 행정동을 찾을 수 없습니다.");
    return;
  }

  updateRegionPanel(region);

  if (geoRegionLayers[dong]) {
    map.fitBounds(
      geoRegionLayers[dong].getBounds(),
      {
        padding: [24, 24],
        maxZoom: 15
      }
    );

    geoRegionLayers[dong].openPopup();
    return;
  }

  const lat = Number(region["대표위도"]);
  const lng = Number(region["대표경도"]);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    map.flyTo([lat, lng], 15, {
      duration: 0.7
    });
  }
}

async function loadMapData() {
  try {
    await loadRegions();

    await Promise.all([
      loadRanking(),
      loadRegionGeoJson(),
      loadCctv(),
      loadHotspots()
    ]);
  } catch (error) {
    console.error("지도 데이터 로딩 오류:", error);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  initMap
);
