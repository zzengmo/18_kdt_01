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
let guBoundaryLayer = null;
let selectedRegionLayer = null;

// data/regions 는 법정동 단위, 경계 geojson(static/data/bukgu_dong.geojson)은
// 행정동 단위라 이름이 1:1로 안 맞는 곳이 있어 행정동 -> 법정동 매핑으로 보정한다.
// (행정동이 여러 법정동을 묶은 경우만 기재, 이름이 같은 동은 생략)
const ADMIN_TO_LEGAL_DONGS = {
  "침산1동": ["침산동"],
  "침산2동": ["침산동"],
  "침산3동": ["침산동"],
  "산격1동": ["산격동"],
  "산격2동": ["산격동"],
  "산격3동": ["산격동"],
  "산격4동": ["산격동"],
  "복현1동": ["복현동"],
  "복현2동": ["복현동"],
  "태전1동": ["태전동"],
  "태전2동": ["태전동"],
  "무태조야동": ["무태조야동", "서변동", "동변동", "연경동", "조야동"],
  "관문동": ["매천동", "사수동", "팔달동", "금호동", "노곡동"],
  "국우동": ["국우동", "학정동", "동호동", "도남동"]
};

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

function buildRegionPopup(region, adminDong, matches) {
  const title =
    adminDong && adminDong !== region["동"]
      ? `${adminDong} <small>(${region["동"]})</small>`
      : region["동"];

  const others =
    matches && matches.length > 1
      ? `
        <div class="popup-sub-list">
          <strong>포함 법정동 (${matches.length}개)</strong>
          <ul>
            ${matches
              .map(
                item =>
                  `<li>${item["동"]} · ${item["관리등급"]}등급 · ${formatScore(item["관리점수"])}점</li>`
              )
              .join("")}
          </ul>
        </div>
      `
      : "";

  return `
    <div class="region-popup">
      <h3>${title}</h3>
      <table>
        <tr><th>관리등급</th><td>${region["관리등급"]}</td></tr>
        <tr><th>관리점수</th><td>${formatScore(region["관리점수"])}점</td></tr>
        <tr><th>단속건수</th><td>${formatNumber(region["단속건수_2017_2023"])}건</td></tr>
        <tr><th>민원건수</th><td>${formatNumber(region["민원건수_2018_2021"])}건</td></tr>
        <tr><th>CCTV</th><td>${formatNumber(region["CCTV수"])}대</td></tr>
        <tr><th>집중요일</th><td>${region["집중요일"] || "-"}</td></tr>
        <tr><th>집중시간</th><td>${region["집중시간"]}시</td></tr>
      </table>
      ${others}
    </div>
  `;
}

// 행정동 이름(geojson)에 대응하는 법정동 region 데이터들을 반환
function getRegionsForAdminDong(adminDong) {
  const legalNames = ADMIN_TO_LEGAL_DONGS[adminDong] || [adminDong];

  return legalNames
    .map(name => regionDataMap[name])
    .filter(Boolean);
}

// 한 행정동에 법정동이 여러 개 묶인 경우, 관리점수가 가장 높은(우선순위가 높은) 곳을 대표로 표시
function pickPrimaryRegion(regions) {
  if (!regions || regions.length === 0) {
    return null;
  }

  return regions.reduce((best, region) => {
    const score = Number(region["관리점수"]) || 0;
    const bestScore = Number(best["관리점수"]) || 0;
    return score > bestScore ? region : best;
  });
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

// 대구 북구 전체 외곽 경계선 (동 경계와 별개로 항상 표시)
async function loadGuBoundary() {
  try {
    const response = await fetch("/static/data/bukgu_boundary.geojson");

    if (!response.ok) {
      return null;
    }

    const geojson = await response.json();

    guBoundaryLayer = L.geoJSON(geojson, {
      style: {
        color: "#1d2939",
        weight: 3.5,
        opacity: 1,
        fill: false
      },
      interactive: false
    });

    guBoundaryLayer.addTo(map);

    return guBoundaryLayer.getBounds();
  } catch (error) {
    console.log("북구 경계 GeoJSON 없음 또는 오류 → 생략");
    return null;
  }
}

async function loadRegionGeoJson() {
  const guBounds = await loadGuBoundary();

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

    const dongBounds = geoLayer.getBounds();
    const bounds =
      guBounds && guBounds.isValid() ? guBounds : dongBounds;

    if (bounds.isValid()) {
      // fitBounds 애니메이션이 끝나기 전에 setMaxBounds 가 뷰를 강제로
      // 되돌리면 줌 애니메이션이 중간에 끊기면서 툴팁(동 이름 라벨) 패널이
      // 숨김 상태로 남는 문제가 있어, 최초 화면 맞춤은 애니메이션 없이 처리한다.
      map.fitBounds(bounds, { padding: [12, 12], animate: false });
      map.setMaxBounds(bounds.pad(0.15));
    }

    // 북구 경계선이 동 경계(채우기) 위에 그려지도록 맨 위로 올림
    if (guBoundaryLayer) {
      guBoundaryLayer.bringToFront();
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

// 다각형 고리(ring)의 면적 중심(centroid)을 구한다. ring: [[lng, lat], ...]
function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;

    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  area *= 0.5;

  if (Math.abs(area) < 1e-12) {
    const sum = ring.reduce(
      (acc, [x, y]) => [acc[0] + x, acc[1] + y],
      [0, 0]
    );
    return { lng: sum[0] / n, lat: sum[1] / n, area: 0 };
  }

  return {
    lng: cx / (6 * area),
    lat: cy / (6 * area),
    area: Math.abs(area)
  };
}

// 동 이름 라벨 위치: 바운딩박스 중앙 대신, 가장 넓은 폴리곤 조각의 실제
// 면적 중심을 사용 → 모양이 울퉁불퉁하거나(여러 법정동을 합친 동) 길쭉한
// 동도 라벨이 경계선 위가 아니라 실제 땅 안쪽에 찍히게 한다.
function getFeatureLabelLatLng(feature) {
  const geom = feature.geometry;

  if (!geom) {
    return null;
  }

  let outerRings;

  if (geom.type === "Polygon") {
    outerRings = [geom.coordinates[0]];
  } else if (geom.type === "MultiPolygon") {
    outerRings = geom.coordinates.map(part => part[0]);
  } else {
    return null;
  }

  let best = null;

  outerRings.forEach(ring => {
    if (!ring || ring.length < 3) {
      return;
    }

    const centroid = ringCentroid(ring);

    if (!best || centroid.area > best.area) {
      best = centroid;
    }
  });

  return best ? L.latLng(best.lat, best.lng) : null;
}

function regionStyle(feature) {
  const dong = getFeatureDongName(feature);
  const primary = pickPrimaryRegion(getRegionsForAdminDong(dong));
  const grade = primary ? primary["관리등급"] : null;

  return {
    color: "#30485d",
    weight: 1.25,
    fillColor: getGradeColor(grade),
    fillOpacity: primary ? 0.32 : 0.08
  };
}

// 클릭으로 선택된 동을 실제 경계선 모양 그대로 강조하는 스타일
function selectedRegionStyle(feature) {
  return {
    ...regionStyle(feature),
    color: "#111827",
    weight: 4,
    fillOpacity: 0.55
  };
}

// 이전 선택을 원래 스타일로 되돌리고, 새로 클릭한 레이어를 그 동의 실제 경계 모양대로 강조
function selectRegionLayer(layer) {
  if (selectedRegionLayer && selectedRegionLayer !== layer) {
    selectedRegionLayer.setStyle(regionStyle(selectedRegionLayer.feature));
  }

  selectedRegionLayer = layer;
  layer.setStyle(selectedRegionStyle(layer.feature));
  layer.bringToFront();
}

function onEachRegion(feature, layer) {
  const dong = getFeatureDongName(feature);

  if (!dong) {
    return;
  }

  const matches = getRegionsForAdminDong(dong);
  const primary = pickPrimaryRegion(matches);

  geoRegionLayers[dong] = layer;

  // 법정동 이름으로 검색했을 때도 같은 행정동 폴리곤을 찾도록 별칭 등록
  matches.forEach(region => {
    geoRegionLayers[region["동"]] = layer;
  });

  // 동 이름은 폴리곤에 bindTooltip 으로 붙이면 안 된다 — lee_index.html 의
  // bindHoverCards() 가 로드 후 같은 레이어의 툴팁을 unbindTooltip() 하고
  // 상세 정보 호버카드로 교체해버려서 라벨이 사라진다. 툴팁과 완전히 분리된
  // 마커(divIcon)로 그려서 호버카드 교체와 무관하게 항상 보이게 한다.
  const labelCenter =
    getFeatureLabelLatLng(feature) || layer.getBounds().getCenter();

  L.marker(labelCenter, {
    icon: L.divIcon({
      className: "dong-label-icon",
      html: dong,
      iconSize: null
    }),
    interactive: false,
    keyboard: false
  }).addTo(regionLayer);

  if (!primary) {
    return;
  }

  layer.bindPopup(buildRegionPopup(primary, dong, matches));

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 3,
      fillOpacity: 0.5
    });
  });

  layer.on("mouseout", () => {
    if (layer === selectedRegionLayer) {
      layer.setStyle(selectedRegionStyle(feature));
      return;
    }

    layer.setStyle(regionStyle(feature));
  });

  layer.on("click", () => {
    updateRegionPanel(primary);
    selectRegionLayer(layer);
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

    selectRegionLayer(geoRegionLayers[dong]);
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
