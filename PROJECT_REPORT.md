대구 북구 불법주정차 관리 분석 대시보드
대구광역시 북구의 불법주정차 단속·민원·CCTV·상습 발생지역 데이터를 통합 분석하여
지역별 관리 우선도를 산출하고, 지도 기반 웹 대시보드로 시각화하는 프로젝트입니다.
단순히 “불법주정차가 많은 곳”을 보여주는 데서 끝나지 않고,
- 어느 지역에서 단속이 많이 발생하는지
- 어떤 요일·시간대에 집중되는지
- 민원이 많이 발생하는 지역은 어디인지
- CCTV가 충분한지
- 반복적으로 민원이 발생하는 지역은 어디인지
를 함께 고려하여 관리 우선도 점수와 등급을 산출하고, 이를 Leaflet 지도와 Flask 기반 웹 서비스에서 확인할 수 있도록 구현했습니다.
1. 프로젝트 개요
프로젝트 주제
대구 북구 불법주정차 데이터 기반 관리 우선지역 분석 및 지도 시각화
프로젝트 목표
1. 여러 기간의 불법주정차 데이터를 하나의 공통 데이터셋으로 통합
2. 날짜·시간·장소 기준으로 불법주정차 발생 특성 분석
3. 민원·CCTV·상습 발생지역 데이터를 결합한 지역 단위 분석
4. 여러 지표를 종합한 관리 우선도 점수 산출
5. 관리 우선도를 A/B/C/D 등급으로 구분
6. 행정동 경계 GeoJSON을 활용한 지도 기반 시각화
7. Flask API를 이용해 분석 결과를 웹 대시보드와 연결
2. 핵심 분석 결과
항목	결과
전체 단속 건수	681,828건
분석 기간	2017-01-01 ~ 2023-12-31
최다 단속 연도	2023년
최다 단속 월	11월
최다 단속 요일	월요일
최다 단속 시간	15시
15시 단속 건수	114,933건
지도 표시 가능 지역	27개
전체 분석 지역	27개
최다 단속 장소	동아아울렛 뒤편
최다 단속 장소 건수	17,189건


단속 원본에는 별도의 행정동 컬럼이 없는 경우가 있어 위반장소 문자열에서 동 이름을 추출하여 지역 단위 분석에 활용했습니다.

3. 분석 흐름
원본 데이터
   │
   ▼
01_preprocessing.ipynb
   │
   ├─ 원본 파일 통합
   ├─ 컬럼 정리
   ├─ 날짜형 변환
   ├─ 연도/월/요일/시간 생성
   ▼
violation_2017_2023.csv
   │
   ├──────────────┬──────────────┬──────────────┐
   ▼              ▼              ▼              ▼
02 날짜분석      03 시간분석     04 장소분석     05 민원/CCTV 분석
   │              │              │              │
   └──────────────┴──────────────┴──────────────┘
                         │
                         ▼
                06_final_analysis.ipynb
                         │
                         ├─ 동별 데이터 통합
                         ├─ 관리점수 계산
                         ├─ 백분위 계산
                         ├─ 관리등급 산정
                         ▼
              final_region_summary.csv
                         │
                         ▼
                     Flask API
                         │
                         ▼
                Leaflet 웹 대시보드
4. Notebook 구성
01_preprocessing.ipynb
공통 전처리 데이터를 생성합니다.
주요 작업:
- 여러 불법주정차 원본 파일 통합
- 컬럼명 정리
- 날짜 데이터 변환
- 결측 및 이상 데이터 점검
- 연도, 월, 요일, 시간 파생변수 생성
- 공통 분석용 CSV 저장
주요 결과:
data/processed/violation_2017_2023.csv
data/processed/violation_2025.csv
02_date_analysis.ipynb
불법주정차의 날짜 특성을 분석합니다.
주요 분석:
- 연도별 단속 건수
- 월별 단속 건수
- 요일별 단속 건수
- 연도 × 월 Heatmap
- 2025년 데이터 날짜 특성 분석
03_time_analysis.ipynb
불법주정차의 시간대 특성을 분석합니다.
주요 분석:
- 0~23시 시간대별 단속 건수
- 집중 발생 시간
- 요일 × 시간 분석
- 특정 시간대 집중 여부 확인
04_location_analysis.ipynb
불법주정차가 어디에서 집중되는지 분석합니다.
주요 분석:
- 위반장소 TOP10
- 장소별 집중 시간
- 장소 × 시간 Heatmap
- 장소별 연도 추이
주요 결과:
data/processed/location_top10_summary.csv
data/processed/location_top10_hour.csv
data/processed/location_top10_year.csv
05_hotspot_analysis.ipynb
민원, CCTV, 상습 발생지역을 함께 분석합니다.
주요 분석:
- 동별 민원 건수
- CCTV 설치 현황
- 주정차단속 CCTV 수
- 상습 민원 발생지역
- 2025년 단속유형
- 민원과 CCTV의 지역별 비교
주요 결과:
data/processed/hotspot_clean.csv
data/processed/dong_support_summary.csv
data/processed/enforcement_2025_summary.csv
data/processed/lee_complaint_2018_2021.csv
data/processed/lee_cctv_location.csv
06_final_analysis.ipynb
프로젝트의 최종 통합 분석을 수행합니다.
주요 작업:
- 동별 단속 건수 통합
- 집중요일 / 집중시간 계산
- 민원 / CCTV / 상습지역 데이터 결합
- 동별 대표 좌표 생성 및 보완
- 관리점수 계산
- 관리점수 백분위 계산
- A/B/C/D 관리등급 산정
- 웹 대시보드용 최종 데이터 생성
주요 결과:
data/processed/final_region_summary.csv
data/processed/final_overall_summary.csv
5. 관리 우선도 점수 산정 방식
항목별 가중치
평가 항목	최대 배점	의미
단속 발생량	40점	실제 불법주정차 단속이 많은 지역
민원 발생량	25점	주민 민원이 많이 발생한 지역
시간 집중도	20점	특정 시간대에 불법주정차가 집중되는 지역
CCTV 부족도	15점	주정차단속 CCTV가 상대적으로 부족한 지역
합계	100점	


각 항목은 북구 분석지역 내 상대 백분위 순위를 이용하여 계산합니다.
단속점수 = 단속건수 백분위 × 40
민원점수 = 민원건수 백분위 × 25
시간집중점수 = 집중시간비중 백분위 × 20
CCTV부족점수 = (1 - 주정차단속 CCTV 수 백분위) × 15
최종 관리점수:
관리점수
= 단속점수
+ 민원점수
+ 시간집중점수
+ CCTV부족점수
6. 관리등급 산정
관리점수 자체를 다시 전체 분석지역 내 백분위로 변환합니다.
관리점수백분위
= 관리점수의 상대순위 × 100
현재 프로젝트 기준:
관리등급	관리점수 백분위	의미
A	90 이상	최우선 관리지역
B	70 이상 ~ 90 미만	우선 관리지역
C	40 이상 ~ 70 미만	일반 관리지역
D	40 미만	상대적 관리 우선도 낮음


관리등급은 대구광역시 또는 북구청의 공식 행정등급이 아니라 본 프로젝트에서 정의한 상대적 분석지표입니다.

7. 웹 대시보드 주요 기능
7.1 행정동 관리등급 지도
Leaflet과 GeoJSON을 이용하여 북구 행정동 경계를 지도에 표시합니다.
- A/B/C/D 관리등급별 영역 색상 구분
- 행정동 클릭 시 해당 지역 상세정보 표시
- 북구 전체 외곽 경계 강조
- 행정동 검색
- 관리 우선순위 TOP5 선택 및 지도 이동
사용 GeoJSON:
static/data/bukgu_boundary.geojson
static/data/bukgu_dong.geojson
7.2 행정동 ↔ 법정동 매핑 보정
분석 데이터와 지도 경계 데이터의 지역 단위가 서로 다른 경우를 보정합니다.
예:
분석 데이터: 산격동
GeoJSON: 산격1동, 산격2동, 산격3동, 산격4동
map.js에서 행정동 → 법정동 매핑을 별도로 관리합니다.
7.3 선택 지역 상세정보
지도에서 지역을 선택하면 다음 정보를 확인할 수 있습니다.
관리등급
관리점수
단속건수
민원건수
CCTV 수
집중요일
집중시간
관리유형
7.4 CCTV 레이어
CCTV 데이터의 위도·경도를 이용하여 지도에 CCTV 위치를 표시합니다.
7.5 상습 민원지역 레이어
상습 민원 발생지점을 별도 레이어로 표시하며, 누적 민원건수가 많을수록 마커 크기가 커집니다.
7.6 관리 우선순위 TOP5
Flask에서 관리점수 기준으로 지역을 정렬하여 상위 5개 지역을 웹에 제공합니다.
7.7 분석 그래프
Notebook에서 생성한 주요 분석 그래프를 웹에서 확인할 수 있습니다.
카테고리:
우선도
장소·시간
민원·CCTV
대표 이미지:
static/images/final_priority_top10.png
static/images/final_priority_score_heatmap.png
static/images/final_violation_complaint_scatter.png
static/images/location_top10_hour_heatmap.png
static/images/location_top10_year_trend.png
static/images/hotspot_dong_complaint_cctv.png
8. Flask API
Endpoint	기능
/	메인 대시보드
/api/summary	전체 분석 요약
/api/regions	전체 지역 분석결과
/api/region/<dong_name>	특정 동 상세정보
/api/ranking	관리 우선순위 상위/하위 지역
/api/cctv	CCTV 좌표 데이터
/api/hotspots	상습 민원지역 데이터
/api/location-top10	장소 TOP10 분석결과
/api/health	서버 및 데이터 로딩 상태 확인


9. 기술 스택
Data Analysis
- Python
- Pandas
- NumPy
- Matplotlib
- Seaborn
- Jupyter Notebook
Backend
- Flask
Frontend
- HTML
- CSS
- JavaScript
Map
- Leaflet.js
- OpenStreetMap
- GeoJSON
Version Control
- Git
- GitHub
10. 프로젝트 구조
18_kdt_01/
│
├─ app.py
├─ requirements.txt
│
├─ data/
│  └─ processed/
│     ├─ violation_2017_2023.csv
│     ├─ violation_2025.csv
│     ├─ lee_complaint_2018_2021.csv
│     ├─ lee_cctv_location.csv
│     ├─ hotspot_clean.csv
│     ├─ dong_support_summary.csv
│     ├─ enforcement_2025_summary.csv
│     ├─ location_top10_summary.csv
│     ├─ location_top10_hour.csv
│     ├─ location_top10_year.csv
│     ├─ final_region_summary.csv
│     └─ final_overall_summary.csv
│
├─ notebooks/
│  ├─ 01_preprocessing.ipynb
│  ├─ 02_date_analysis.ipynb
│  ├─ 03_time_analysis.ipynb
│  ├─ 04_location_analysis.ipynb
│  ├─ 05_hotspot_analysis.ipynb
│  └─ 06_final_analysis.ipynb
│
├─ templates/
│  ├─ index.html
│  ├─ lee_index.html
│  └─ lee_index2.html
│
├─ static/
│  ├─ css/
│  │  ├─ style.css
│  │  ├─ lee_style.css
│  │  └─ lee_style2.css
│  ├─ js/
│  │  └─ map.js
│  ├─ data/
│  │  ├─ bukgu_boundary.geojson
│  │  └─ bukgu_dong.geojson
│  └─ images/
│     └─ 분석 그래프 PNG
│
└─ README.md
11. 실행 방법
git clone https://github.com/zzengmo/18_kdt_01.git
cd 18_kdt_01
pip install -r requirements.txt
python app.py
브라우저:
http://127.0.0.1:5000
API 상태 확인:
http://127.0.0.1:5000/api/health
현재 requirements.txt:
Flask
pandas
numpy
Notebook을 처음부터 실행하려면:
pip install matplotlib seaborn jupyter
12. 팀 역할 분담
김현모
공통 전처리 / 최종 통합 / Flask Backend
- 01_preprocessing.ipynb
- 02_date_analysis.ipynb
- 06_final_analysis.ipynb
- app.py
- 최종 데이터 통합
- 관리점수 및 관리등급 산정
- Flask API 구성
김교은
시간·요일 분석 / 분석 그래프
- 03_time_analysis.ipynb
- 시간대별 분석
- 요일별 분석
- 요일 × 시간 분석
- 분석 그래프 제작
김민호
장소 분석 / 지도
- 04_location_analysis.ipynb
- 장소 TOP 분석
- 장소별 시간대 분석
- 장소별 연도 추이
- Leaflet 지도 기능
- GeoJSON 행정동 경계 연결
이기승
민원·CCTV·상습지역 분석 / UI
- 05_hotspot_analysis.ipynb
- 민원 데이터 분석
- CCTV 분석
- 상습 발생지역 분석
- 웹 UI/CSS
13. 프로젝트에서 해결한 주요 문제
CSV 한글 인코딩 문제
공공데이터 CSV에서 UTF-8 / CP949 차이로 한글 깨짐이 발생했고, 전처리 결과는 utf-8-sig 중심으로 저장했습니다.
단속 데이터의 행정동 정보 부족
위반장소 문자열에서 동 이름을 추출하여 지역 분석에 활용했습니다.
지도 데이터와 분석 데이터의 행정구역 단위 차이
GeoJSON은 행정동 기준, 분석 데이터는 법정동 기준인 경우가 있어 map.js에서 별도 매핑을 구현했습니다.
좌표 누락 문제
대표좌표는 아래 우선순위로 보완했습니다.
2020 불법주차 좌표
→ 민원 좌표
→ CCTV 좌표
→ 상습 발생지 좌표
JSON 변환 문제
Pandas/NumPy 자료형과 NaN 값을 Flask JSON으로 안전하게 변환하는 공통 함수를 구현했습니다.
14. 분석 해석 시 주의사항
1. 관리등급은 공식 행정기관의 위험등급이 아닌 프로젝트 내부 상대지표입니다.
2. 단속·민원·CCTV 데이터의 기준기간이 서로 다릅니다.
3. 단속 데이터의 동 정보는 장소 문자열에서 추출한 값이 포함됩니다.
4. 대표 좌표는 공식 행정동 중심점이 아니라 분석 데이터의 평균 위치를 활용했습니다.
5. CCTV가 적다는 사실만으로 반드시 관리가 부족하다고 단정할 수는 없습니다.
6. 관리점수 가중치 40 : 25 : 20 : 15는 프로젝트 분석 목적에 맞게 정의한 기준입니다.
7. 결과는 정책 결정 자체가 아니라 집중관리 후보지역 탐색을 위한 참고지표로 해석해야 합니다.
15. 향후 개선 방향
- 실시간 교통정보 연계
- 실시간 CCTV 메타데이터 연계
- 시간 슬라이더 기반 동적 관리지도
- 도로 폭 / 유동인구 / 교통량 데이터 추가
- 학교·병원·시장 등 주요 시설 반영
- 단속 이후 재발률 분석
- Render 또는 기타 웹 서비스 배포
16. 프로젝트 의의
이 프로젝트는 단순 시각화가 아니라,
데이터 수집
→ 전처리
→ 탐색적 데이터 분석
→ 지역 단위 통합
→ 지표 설계
→ 백분위 기반 관리등급
→ 지도 시각화
→ Flask API
→ 웹 대시보드
까지 하나의 흐름으로 구현했습니다.
특히 분석 결과를 웹 지도와 연결하여
**“어디에서, 언제, 왜 관리가 필요한가”**를 한 화면에서 확인할 수 있도록 구성했습니다