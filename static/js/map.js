// ==========================================================
// 대구 북구 불법주정차 관리 대시보드
// map.js
// ==========================================================


// ==========================================================
// 1. 기본 설정
// ==========================================================

// 대구 북구 중심
const BUKGU_CENTER = [
  35.92,
  128.58
];


// 관리등급 색상
const GRADE_COLORS = {

  A: "#d73027",

  B: "#fc8d59",

  C: "#fee08b",

  D: "#91cf60",

  default: "#999999"
};


// 지도 객체
let map;


// 지도 레이어
let regionLayer;

let cctvLayer;

let hotspotLayer;


// ==========================================================
// 2. 지도 생성
// ==========================================================

function initMap() {

  // Leaflet 지도 생성
  map = L.map(
    "map"
  ).setView(
    BUKGU_CENTER,
    12
  );


  // OpenStreetMap 배경지도
  L.tileLayer(

    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

    {

      maxZoom: 19,

      attribution:
        "&copy; OpenStreetMap contributors"

    }

  ).addTo(
    map
  );


  // 동별 관리등급 레이어
  regionLayer =
    L.layerGroup()
    .addTo(map);


  // CCTV 레이어
  cctvLayer =
    L.layerGroup();


  // 상습 민원지역 레이어
  hotspotLayer =
    L.layerGroup();


  // 지도 우측 레이어 선택
  L.control.layers(

    null,

    {

      "동별 관리 현황":
        regionLayer,

      "CCTV 위치":
        cctvLayer,

      "상습 민원지역":
        hotspotLayer

    },

    {

      collapsed: false

    }

  ).addTo(
    map
  );


  // 등급 범례
  addGradeLegend();


  // 데이터 로딩
  loadMapData();

}


// ==========================================================
// 3. API 데이터 요청
// ==========================================================

async function fetchJson(url) {

  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(

      `${url} 요청 실패`

    );

  }


  return await response.json();

}


// ==========================================================
// 4. 숫자 표시 함수
// ==========================================================

function formatNumber(value) {

  const num =
    Number(value);


  if (
    !Number.isFinite(num)
  ) {

    return "-";

  }


  return Math.round(
    num
  ).toLocaleString(
    "ko-KR"
  );

}


// ==========================================================
// 5. 관리등급 색상
// ==========================================================

function getGradeColor(
  grade
) {

  return (
    GRADE_COLORS[
      grade
    ]
    ||
    GRADE_COLORS.default
  );

}


// ==========================================================
// 6. 오른쪽 상세 패널 변경
// ==========================================================

function updateRegionPanel(
  region
) {

  document.getElementById(
    "region-name"
  ).textContent =
    region["동"];


  document.getElementById(
    "grade"
  ).textContent =
    region["관리등급"];


  document.getElementById(
    "score"
  ).textContent =
    `${region["관리점수"]}점`;


  document.getElementById(
    "violation-count"
  ).textContent =
    `${formatNumber(
      region[
        "단속건수_2017_2023"
      ]
    )}건`;


  document.getElementById(
    "complaint-count"
  ).textContent =
    `${formatNumber(
      region[
        "민원건수_2018_2021"
      ]
    )}건`;


  document.getElementById(
    "cctv-count"
  ).textContent =
    `${formatNumber(
      region["CCTV수"]
    )}대`;


  document.getElementById(
    "peak-weekday"
  ).textContent =
    region["집중요일"];


  document.getElementById(
    "peak-hour"
  ).textContent =
    `${region["집중시간"]}시`;


  document.getElementById(
    "management-type"
  ).textContent =
    region["관리유형"];


  // 관리등급 색상
  document.getElementById(
    "grade"
  ).style.color =
    getGradeColor(
      region["관리등급"]
    );

}


// ==========================================================
// 7. 동별 관리 마커 생성
// ==========================================================

function createRegionMarker(
  region
) {

  const lat =
    Number(
      region["대표위도"]
    );


  const lng =
    Number(
      region["대표경도"]
    );


  // 좌표가 없으면 표시하지 않음
  if (
    !Number.isFinite(lat)
    ||
    !Number.isFinite(lng)
  ) {

    return null;

  }


  const grade =
    region["관리등급"];


  const color =
    getGradeColor(
      grade
    );


  // 원형 마커
  const marker =
    L.circleMarker(

      [
        lat,
        lng
      ],

      {

        radius:
          grade === "A"
          ? 10
          : 8,

        color:
          "#333",

        fillColor:
          color,

        fillOpacity:
          0.85,

        weight:
          1.5

      }

    );


  // 마우스 올렸을 때
  marker.bindTooltip(

    `${region["동"]} · ${grade}등급`

  );


  // 클릭 팝업
  marker.bindPopup(`

    <div class="region-popup">

      <h3>
        ${region["동"]}
      </h3>

      <table>

        <tr>

          <th>
            관리등급
          </th>

          <td>
            ${grade}
          </td>

        </tr>


        <tr>

          <th>
            관리점수
          </th>

          <td>
            ${region["관리점수"]}
          </td>

        </tr>


        <tr>

          <th>
            단속건수
          </th>

          <td>

            ${formatNumber(
              region[
                "단속건수_2017_2023"
              ]
            )}건

          </td>

        </tr>


        <tr>

          <th>
            민원건수
          </th>

          <td>

            ${formatNumber(
              region[
                "민원건수_2018_2021"
              ]
            )}건

          </td>

        </tr>


        <tr>

          <th>
            CCTV
          </th>

          <td>

            ${formatNumber(
              region["CCTV수"]
            )}대

          </td>

        </tr>


        <tr>

          <th>
            집중요일
          </th>

          <td>
            ${region["집중요일"]}
          </td>

        </tr>


        <tr>

          <th>
            집중시간
          </th>

          <td>
            ${region["집중시간"]}시
          </td>

        </tr>

      </table>

    </div>

  `);


  // 클릭 시 오른쪽 정보 변경
  marker.on(

    "click",

    function () {

      updateRegionPanel(
        region
      );

    }

  );


  return marker;

}


// ==========================================================
// 8. 동별 데이터 불러오기
// ==========================================================

async function loadRegions() {

  const regions =
    await fetchJson(
      "/api/regions"
    );


  regionLayer.clearLayers();


  const bounds = [];


  regions.forEach(

    function (region) {

      const marker =
        createRegionMarker(
          region
        );


      if (!marker) {

        return;

      }


      marker.addTo(
        regionLayer
      );


      bounds.push(
        marker.getLatLng()
      );

    }

  );


  // 모든 동이 지도에 보이도록
  if (
    bounds.length > 0
  ) {

    map.fitBounds(

      bounds,

      {

        padding:
          [
            30,
            30
          ],

        maxZoom:
          13

      }

    );

  }

}


// ==========================================================
// 9. CCTV 마커
// ==========================================================

function createCctvMarker(
  item
) {

  const lat =
    Number(
      item["위도"]
    );


  const lng =
    Number(
      item["경도"]
    );


  if (
    !Number.isFinite(lat)
    ||
    !Number.isFinite(lng)
  ) {

    return;

  }


  const marker =
    L.circleMarker(

      [
        lat,
        lng
      ],

      {

        radius:
          4,

        color:
          "#2563eb",

        fillColor:
          "#3b82f6",

        fillOpacity:
          0.8

      }

    );


  marker.bindPopup(`

    <strong>
      CCTV
    </strong>

    <br>

    동:
    ${item["동"]}

    <br>

    주소:
    ${item["주소"]}

    <br>

    목적:
    ${item["설치목적구분"]}

  `);


  marker.addTo(
    cctvLayer
  );

}


// ==========================================================
// 10. CCTV 데이터
// ==========================================================

async function loadCctv() {

  const data =
    await fetchJson(
      "/api/cctv"
    );


  cctvLayer.clearLayers();


  data.forEach(

    createCctvMarker

  );

}


// ==========================================================
// 11. 상습 민원지역
// ==========================================================

function createHotspotMarker(
  item
) {

  const lat =
    Number(
      item["위도"]
    );


  const lng =
    Number(
      item["경도"]
    );


  if (
    !Number.isFinite(lat)
    ||
    !Number.isFinite(lng)
  ) {

    return;

  }


  const count =
    Number(
      item[
        "민원발생누적건수"
      ]
    )
    ||
    0;


  // 민원이 많을수록 원 크기 증가
  const radius =
    Math.min(

      16,

      6 +
      count /
      250

    );


  const marker =
    L.circleMarker(

      [
        lat,
        lng
      ],

      {

        radius:
          radius,

        color:
          "#7c3aed",

        fillColor:
          "#a855f7",

        fillOpacity:
          0.6

      }

    );


  marker.bindPopup(`

    <strong>
      상습 민원지역
    </strong>

    <br>

    ${item["짧은주소"]}

    <br>

    누적 민원:

    ${formatNumber(
      item[
        "민원발생누적건수"
      ]
    )}건

  `);


  marker.addTo(
    hotspotLayer
  );

}


// ==========================================================
// 12. 상습 민원 데이터
// ==========================================================

async function loadHotspots() {

  const data =
    await fetchJson(
      "/api/hotspots"
    );


  hotspotLayer.clearLayers();


  data.forEach(

    createHotspotMarker

  );

}


// ==========================================================
// 13. 관리등급 범례
// ==========================================================

function addGradeLegend() {

  const legend =
    L.control({

      position:
        "bottomright"

    });


  legend.onAdd =
    function () {

      const div =
        L.DomUtil.create(

          "div",

          "grade-legend"

        );


      div.innerHTML = `

        <strong>
          관리등급
        </strong>

        <div>
          <span class="legend-color grade-a"></span>
          A · 집중관리 우선
        </div>

        <div>
          <span class="legend-color grade-b"></span>
          B · 관리 강화
        </div>

        <div>
          <span class="legend-color grade-c"></span>
          C · 일반 관리
        </div>

        <div>
          <span class="legend-color grade-d"></span>
          D · 우선도 낮음
        </div>

      `;


      return div;

    };


  legend.addTo(
    map
  );

}


// ==========================================================
// 14. 데이터 전체 불러오기
// ==========================================================

async function loadMapData() {

  try {

    await Promise.all([

      loadRegions(),

      loadCctv(),

      loadHotspots()

    ]);


    console.log(
      "지도 데이터 로딩 완료"
    );


  } catch (error) {

    console.error(
      error
    );

  }

}


// ==========================================================
// 15. 시작
// ==========================================================

document.addEventListener(

  "DOMContentLoaded",

  initMap

);