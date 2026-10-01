// ==========================================================
// 대구 북구 불법주정차 관리 대시보드
// map.js
// ==========================================================


// ==========================================================
// 1. 기본 설정
// ==========================================================

const BUKGU_CENTER = [
  35.92,
  128.58
];


const GRADE_COLORS = {

  A: "#d73027",

  B: "#fc8d59",

  C: "#fee08b",

  D: "#91cf60",

  default: "#cccccc"

};


// 지도
let map;


// 레이어
let regionLayer;
let cctvLayer;
let hotspotLayer;


// 동별 데이터 저장
let regionData = [];


// 동 이름 → 데이터
let regionDataMap = {};


// GeoJSON 사용 여부
let useGeoJson = false;


// ==========================================================
// 2. 지도 초기화
// ==========================================================

function initMap() {

  map = L.map(
    "map",
    {

      center:
        BUKGU_CENTER,

      zoom:
        12,

      minZoom:
        11,

      maxZoom:
        18

    }
  );


  // OpenStreetMap
  L.tileLayer(

    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

    {

      maxZoom:
        19,

      attribution:
        "&copy; OpenStreetMap contributors"

    }

  ).addTo(
    map
  );


  // 동별 분석 레이어
  regionLayer =
    L.layerGroup()
    .addTo(map);


  // CCTV
  cctvLayer =
    L.layerGroup();


  // 상습 민원
  hotspotLayer =
    L.layerGroup();


  // 레이어 메뉴
  L.control.layers(

    null,

    {

      "관리 우선도":
        regionLayer,

      "CCTV":
        cctvLayer,

      "상습 민원지역":
        hotspotLayer

    },

    {

      collapsed:
        false

    }

  ).addTo(
    map
  );


  // 범례
  addGradeLegend();


  // 데이터 시작
  loadMapData();

}


// ==========================================================
// 3. API 요청
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
// 4. 기본 포맷
// ==========================================================

function formatNumber(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return "-";

  }


  return Math.round(
    number
  ).toLocaleString(
    "ko-KR"
  );

}


function formatScore(value) {

  const number =
    Number(value);


  if (
    !Number.isFinite(number)
  ) {

    return "-";

  }


  return number.toFixed(
    1
  );

}


// ==========================================================
// 5. 등급 색상
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
// 6. 오른쪽 상세정보
// ==========================================================

function updateRegionPanel(
  region
) {

  setText(
    "region-name",
    region["동"]
  );


  setText(
    "grade",
    region["관리등급"]
  );


  setText(
    "score",
    `${formatScore(
      region["관리점수"]
    )}점`
  );


  setText(
    "violation-count",
    `${formatNumber(
      region[
        "단속건수_2017_2023"
      ]
    )}건`
  );


  setText(
    "complaint-count",
    `${formatNumber(
      region[
        "민원건수_2018_2021"
      ]
    )}건`
  );


  setText(
    "cctv-count",
    `${formatNumber(
      region["CCTV수"]
    )}대`
  );


  setText(
    "peak-weekday",
    region["집중요일"]
  );


  setText(
    "peak-hour",
    `${region["집중시간"]}시`
  );


  setText(
    "management-type",
    region["관리유형"]
  );


  // 등급 색
  const gradeElement =
    document.getElementById(
      "grade"
    );


  if (gradeElement) {

    gradeElement.style.color =
      getGradeColor(
        region["관리등급"]
      );

    gradeElement.style.fontWeight =
      "bold";

  }

}


function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (!element) {

    return;

  }


  element.textContent =

    value === null
    ||
    value === undefined
    ||
    value === ""

    ? "-"

    : value;

}


// ==========================================================
// 7. 팝업 내용
// ==========================================================

function buildRegionPopup(
  region
) {

  return `

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
            ${region["관리등급"]}
          </td>

        </tr>


        <tr>

          <th>
            관리점수
          </th>

          <td>
            ${formatScore(
              region["관리점수"]
            )}점
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


        <tr>

          <th>
            관리유형
          </th>

          <td>
            ${region["관리유형"]}
          </td>

        </tr>

      </table>

    </div>

  `;

}


// ==========================================================
// 8. 동별 데이터 불러오기
// ==========================================================

async function loadRegions() {

  regionData =
    await fetchJson(
      "/api/regions"
    );


  regionDataMap = {};


  regionData.forEach(
    function (region) {

      regionDataMap[
        region["동"]
      ] = region;

    }
  );

}


// ==========================================================
// 9. GeoJSON 행정동 영역
// ==========================================================

async function loadRegionGeoJson() {

  try {

    const response =
      await fetch(
        "/static/data/bukgu_dong.geojson"
      );


    // GeoJSON 파일이 없으면
    // 마커 방식으로 전환
    if (!response.ok) {

      console.log(
        "GeoJSON 없음 → 마커 방식 사용"
      );

      loadRegionMarkers();

      return;

    }


    const geojson =
      await response.json();


    useGeoJson =
      true;


    regionLayer.clearLayers();


    const geoLayer =
      L.geoJSON(

        geojson,

        {

          style:
            regionStyle,


          onEachFeature:
            onEachRegion

        }

      );


    geoLayer.addTo(
      regionLayer
    );


    const bounds =
      geoLayer.getBounds();


    if (
      bounds.isValid()
    ) {

      // 북구 전체가 보이도록
      map.fitBounds(

        bounds,

        {

          padding:
            [
              10,
              10
            ]

        }

      );


      // 북구 밖으로 너무 멀리 이동 못하게
      map.setMaxBounds(
        bounds.pad(
          0.15
        )
      );

    }


    console.log(
      "행정동 GeoJSON 지도 적용 완료"
    );


  }

  catch (error) {

    console.log(
      "GeoJSON 오류 → 마커 방식 사용"
    );


    loadRegionMarkers();

  }

}


// ==========================================================
// 10. GeoJSON 동 이름 찾기
// ==========================================================

function getFeatureDongName(
  feature
) {

  const props =
    feature.properties
    ||
    {};


  // GeoJSON마다 컬럼명이 다를 수 있어서
  // 여러 후보 확인

  return (

    props["동"]

    ||

    props["ADM_DR_NM"]

    ||

    props["adm_nm"]

    ||

    props["EMD_KOR_NM"]

    ||

    props["name"]

    ||

    null

  );

}


// ==========================================================
// 11. GeoJSON 색상
// ==========================================================

function regionStyle(
  feature
) {

  const dong =
    getFeatureDongName(
      feature
    );


  const region =
    regionDataMap[
      dong
    ];


  const grade =
    region
    ? region["관리등급"]
    : null;


  return {

    color:
      "#25364a",

    weight:
      1.5,

    fillColor:
      getGradeColor(
        grade
      ),

    fillOpacity:
      region
      ? 0.55
      : 0.15

  };

}


// ==========================================================
// 12. 행정동 클릭 기능
// ==========================================================

function onEachRegion(
  feature,
  layer
) {

  const dong =
    getFeatureDongName(
      feature
    );


  const region =
    regionDataMap[
      dong
    ];


  // 분석 데이터가 없는 경우
  if (!region) {

    layer.bindTooltip(
      dong || "지역정보 없음"
    );

    return;

  }


  // 마우스 오버
  layer.on(
    "mouseover",

    function () {

      layer.setStyle({

        weight:
          3,

        fillOpacity:
          0.75

      });

    }

  );


  // 마우스 나가면 원래대로
  layer.on(
    "mouseout",

    function () {

      layer.setStyle(
        regionStyle(
          feature
        )
      );

    }

  );


  // 툴팁
  layer.bindTooltip(

    `${dong} · ${region["관리등급"]}등급`

  );


  // 팝업
  layer.bindPopup(

    buildRegionPopup(
      region
    )

  );


  // 클릭
  layer.on(
    "click",

    function () {

      updateRegionPanel(
        region
      );

      map.fitBounds(
        layer.getBounds(),

        {

          padding:
            [
              20,
              20
            ],

          maxZoom:
            15

        }

      );

    }

  );

}


// ==========================================================
// 13. GeoJSON 없을 때 마커
// ==========================================================

function loadRegionMarkers() {

  regionLayer.clearLayers();


  const bounds = [];


  regionData.forEach(

    function (
      region
    ) {

      const lat =
        Number(
          region[
            "대표위도"
          ]
        );


      const lng =
        Number(
          region[
            "대표경도"
          ]
        );


      if (
        !Number.isFinite(lat)
        ||
        !Number.isFinite(lng)
      ) {

        return;

      }


      const color =
        getGradeColor(
          region[
            "관리등급"
          ]
        );


      const marker =
        L.circleMarker(

          [
            lat,
            lng
          ],

          {

            radius:
              region[
                "관리등급"
              ]
              === "A"

              ? 10

              : 8,

            color:
              "#333333",

            weight:
              1,

            fillColor:
              color,

            fillOpacity:
              0.85

          }

        );


      marker.bindTooltip(

        `${region["동"]} · ${region["관리등급"]}등급`

      );


      marker.bindPopup(

        buildRegionPopup(
          region
        )

      );


      marker.on(

        "click",

        function () {

          updateRegionPanel(
            region
          );

        }

      );


      marker.addTo(
        regionLayer
      );


      bounds.push(
        marker.getLatLng()
      );

    }

  );


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
// 14. CCTV
// ==========================================================

async function loadCctv() {

  const data =
    await fetchJson(
      "/api/cctv"
    );


  cctvLayer.clearLayers();


  data.forEach(

    function (item) {

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
              "#1d4ed8",

            fillColor:
              "#3b82f6",

            fillOpacity:
              0.8,

            weight:
              1

          }

        );


      marker.bindPopup(`

        <strong>
          CCTV
        </strong>

        <br>

        동:
        ${item["동"] || "-"}

        <br>

        주소:
        ${item["주소"] || "-"}

        <br>

        설치목적:
        ${item["설치목적구분"] || "-"}

      `);


      marker.addTo(
        cctvLayer
      );

    }

  );

}


// ==========================================================
// 15. 상습 민원지역
// ==========================================================

async function loadHotspots() {

  const data =
    await fetchJson(
      "/api/hotspots"
    );


  hotspotLayer.clearLayers();


  data.forEach(

    function (item) {

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


      const radius =
        Math.min(

          15,

          Math.max(

            5,

            5 +
            count /
            300

          )

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
              "#6d28d9",

            fillColor:
              "#a855f7",

            fillOpacity:
              0.6,

            weight:
              2

          }

        );


      marker.bindPopup(`

        <strong>
          상습 민원지역
        </strong>

        <br>

        ${

          item[
            "짧은주소"
          ]

          ||

          item[
            "주소"
          ]

          ||

          "-"

        }

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

  );

}


// ==========================================================
// 16. 관리등급 범례
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
          관리 우선도
        </strong>

        <br>

        <span class="legend-color grade-a"></span>
        A · 집중관리 우선

        <br>

        <span class="legend-color grade-b"></span>
        B · 관리 강화

        <br>

        <span class="legend-color grade-c"></span>
        C · 일반 관리

        <br>

        <span class="legend-color grade-d"></span>
        D · 상대적 우선도 낮음

      `;


      return div;

    };


  legend.addTo(
    map
  );

}


// ==========================================================
// 17. 전체 데이터 시작
// ==========================================================

async function loadMapData() {

  try {

    // 동별 분석 데이터 먼저
    await loadRegions();


    // GeoJSON 있으면 폴리곤,
    // 없으면 마커
    await loadRegionGeoJson();


    // 보조 레이어
    await Promise.all([

      loadCctv(),

      loadHotspots()

    ]);


    console.log(
      "지도 데이터 로딩 완료"
    );


  }

  catch (error) {

    console.error(
      "지도 데이터 로딩 오류",
      error
    );

  }

}


// ==========================================================
// 18. 실행
// ==========================================================

document.addEventListener(

  "DOMContentLoaded",

  initMap

);