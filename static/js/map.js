/**
 * 대구 북구 불법주정차 대시보드 - 지도 기능 (Leaflet.js + OpenStreetMap)
 *
 * ⚠️ 백엔드 의존성 안내 (app.py 담당자와 맞춰야 하는 부분)
 * - 이 파일은 GET /api/regions 가 JSON 배열을 반환한다고 가정합니다.
 * - 배열의 각 객체는 data/processed/final_region_summary.csv의 "컬럼명을 그대로" key로 사용해야 합니다.
 *   예: { "동": "동천동", "대표위도": 35.93, "대표경도": 128.55, "관리등급": "B", ... }
 * - 현재 CSV에는 "좌표출처", "지도표시가능", "관리점수백분위" 컬럼이 아직 없습니다.
 *   "지도표시가능"이 없는 경우, 대표위도/대표경도가 유효한 숫자인 지역만 자동으로 표시합니다.
 *   (나중에 컬럼이 추가되면 자동으로 그 값을 우선 사용하도록 처리해 두었습니다.)
 *
 * 담당 범위: 지도 기능만. index.html / app.py / charts.js는 수정하지 않습니다.
 */

// 관리등급(A/B/C/D)에 따른 마커 색상
// A: 관리 우선도가 가장 높은 지역(빨강) ~ D: 가장 낮은 지역(초록)
const GRADE_COLORS = {
  A: "#e74c3c",
  B: "#e67e22",
  C: "#f1c40f",
  D: "#2ecc71",
  default: "#95a5a6" // 등급 정보가 없는 경우
};

// 대구광역시 북구 대략적인 중심 좌표
const BUKGU_CENTER = [35.908, 128.590];
const BUKGU_INIT_ZOOM = 13;

// 모듈 전체에서 공유하는 지도/레이어 객체
let map = null;
let regionMarkersLayer = null; // 동별 관리현황 마커 (기본 레이어)
let cctvLayer = null;          // 추후 확장: CCTV 위치
let complaintLayer = null;     // 추후 확장: 민원 발생
let hotspotLayer = null;       // 추후 확장: 상습 발생지
let gradeLayer = null;         // 추후 확장: 관리등급 영역(Choropleth 등)

/**
 * 1. 지도 초기화
 * - 대구 북구 중심으로 Leaflet 지도를 생성하고 OSM 타일을 올린다.
 * - 레이어 구조(기본 + 추후 확장용 빈 레이어)를 만들고 레이어 컨트롤을 등록한다.
 * - 지역 데이터 로딩(loadRegions)을 시작한다.
 */
function initMap() {
  map = L.map("map", {
    center: BUKGU_CENTER,
    zoom: BUKGU_INIT_ZOOM
  });

  // OpenStreetMap 타일 레이어
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // 레이어 그룹 생성 (지금은 비어있는 레이어도 미리 만들어 둠 -> 추후 확장 용이)
  regionMarkersLayer = L.layerGroup().addTo(map);
  cctvLayer = L.layerGroup();
  complaintLayer = L.layerGroup();
  hotspotLayer = L.layerGroup();
  gradeLayer = L.layerGroup();

  // 레이어 선택 컨트롤 (오른쪽 상단). 준비중인 레이어는 데이터 연결 전까지 비어있는 상태로 토글만 가능.
  L.control
    .layers(null, {
      "동별 관리 현황": regionMarkersLayer,
      "CCTV 위치 (준비중)": cctvLayer,
      "민원 발생 (준비중)": complaintLayer,
      "상습 발생지 (준비중)": hotspotLayer,
      "관리등급 영역 (준비중)": gradeLayer
    })
    .addTo(map);

  loadRegions();
}

/**
 * 2. 동별 데이터 로딩
 * - /api/regions 에서 동별 요약 데이터를 가져온다.
 * - "지도표시가능" 조건을 만족하는 지역만 걸러서 마커로 추가한다.
 */
async function loadRegions() {
  try {
    const response = await fetch("/api/regions");
    if (!response.ok) {
      throw new Error("지역 데이터 응답 오류: " + response.status);
    }

    const regions = await response.json();

    regionMarkersLayer.clearLayers();

    regions
      .filter(isDisplayable)
      .forEach((region) => {
        const marker = createRegionMarker(region);
        if (marker) {
          marker.addTo(regionMarkersLayer);
        }
      });
  } catch (error) {
    // 백엔드(/api/regions)가 아직 준비되지 않았거나 통신에 실패한 경우
    console.error("[map.js] 지역 데이터를 불러오지 못했습니다.", error);
  }
}

/**
 * 지역을 지도에 표시할 수 있는지 판단한다.
 * - "지도표시가능" 컬럼이 있으면 그 값을 우선 사용 (true / "True" / 1 모두 허용)
 * - 없으면 대표위도/대표경도가 유효한 숫자인 경우에만 표시 (현재 CSV 상태에 대한 대응)
 */
function isDisplayable(region) {
  if (Object.prototype.hasOwnProperty.call(region, "지도표시가능")) {
    const flag = region["지도표시가능"];
    return flag === true || flag === "True" || flag === "TRUE" || flag === 1 || flag === "1";
  }

  const lat = parseFloat(region["대표위도"]);
  const lng = parseFloat(region["대표경도"]);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * 3. 동 마커 생성
 * - 좌표에 원형 마커를 만들고, 관리등급에 따라 색을 입힌다.
 * - 팝업(요약 정보)을 붙이고, 클릭 시 상세패널 갱신 + 다른 JS(charts.js)에 선택된 지역을 알린다.
 */
function createRegionMarker(region) {
  const lat = parseFloat(region["대표위도"]);
  const lng = parseFloat(region["대표경도"]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const grade = region["관리등급"];
  const fillColor = GRADE_COLORS[grade] || GRADE_COLORS.default;

  const marker = L.circleMarker([lat, lng], {
    radius: 9,
    color: "#333333",
    weight: 1,
    fillColor: fillColor,
    fillOpacity: 0.85
  });

  marker.bindPopup(buildPopupContent(region));

  // 마커 클릭 -> 상세패널 갱신 + 선택된 지역 전역 공유
  marker.on("click", () => {
    updateRegionPanel(region);
    notifyRegionSelected(region);
  });

  return marker;
}

/**
 * 팝업에 표시할 HTML 콘텐츠를 만든다.
 */
function buildPopupContent(region) {
  return `
    <div class="region-popup">
      <h3>${region["동"]}</h3>
      <table>
        <tr><th>관리등급</th><td>${region["관리등급"] ?? "-"}</td></tr>
        <tr><th>관리점수</th><td>${formatScore(region["관리점수"])}</td></tr>
        <tr><th>단속건수</th><td>${formatCount(region["단속건수_2017_2023"])}</td></tr>
        <tr><th>민원건수</th><td>${formatCount(region["민원건수_2018_2021"])}</td></tr>
        <tr><th>CCTV수</th><td>${formatCount(region["CCTV수"])}</td></tr>
        <tr><th>집중요일</th><td>${region["집중요일"] ?? "자료없음"}</td></tr>
        <tr><th>집중시간</th><td>${formatPeakHour(region["집중시간"])}</td></tr>
        <tr><th>관리유형</th><td>${region["관리유형"] ?? "-"}</td></tr>
      </table>
    </div>
  `;
}

/**
 * 4. 상세패널(오른쪽 패널) 갱신
 * - index.html에 존재하는 고정 id들의 텍스트를 선택된 지역 데이터로 채운다.
 */
function updateRegionPanel(region) {
  setText("region-name", region["동"]);
  setText("grade", region["관리등급"]);
  setText("score", formatScore(region["관리점수"]));
  setText("violation-count", formatCount(region["단속건수_2017_2023"]));
  setText("complaint-count", formatCount(region["민원건수_2018_2021"]));
  setText("cctv-count", formatCount(region["CCTV수"]));
  setText("peak-weekday", region["집중요일"]);
  setText("peak-hour", formatPeakHour(region["집중시간"]));
  setText("management-type", region["관리유형"]);
}

/**
 * 선택된 지역을 다른 스크립트(charts.js 등)에서도 쓸 수 있도록 공유한다.
 * - CustomEvent("region:selected")를 document에 발행 (이벤트 리스너 방식)
 * - window.DashboardState에도 최신 선택값을 저장 (즉시 조회 방식)
 * charts.js에서는 아래처럼 사용 가능:
 *   document.addEventListener("region:selected", (e) => { const region = e.detail; ... });
 */
function notifyRegionSelected(region) {
  window.DashboardState = window.DashboardState || {};
  window.DashboardState.selectedRegionName = region["동"];
  window.DashboardState.selectedRegionData = region;

  document.dispatchEvent(new CustomEvent("region:selected", { detail: region }));
}

// ---- 포맷 유틸 ----

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value === null || value === undefined || value === "" ? "-" : value;
  }
}

function formatScore(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : "-";
}

function formatCount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num).toLocaleString("ko-KR") : "-";
}

function formatPeakHour(hour) {
  const num = Number(hour);
  if (!Number.isFinite(num) || num < 0) {
    return "자료없음";
  }
  return `${num}시`;
}

// 페이지 로드 완료 후 지도 초기화
document.addEventListener("DOMContentLoaded", initMap);
