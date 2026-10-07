# 18_kdt_01 - 불법주정차 데이터 분석 프로젝트
지역별 불법주정차 데이터를 분석해서 문제를 발견하고 정책 아이디어를 제안합니다.

---

## 📄 프로젝트 문서

프로젝트의 전체 분석 과정, 데이터 전처리, 관리 우선도 점수 산정,
웹 시연 화면 및 제안사항은 아래 최종보고서에서 확인할 수 있습니다.

[📘 불법주정차 프로젝트 최종보고서 보기](./docs/불법주정차_프로젝트_최종보고서.pdf)

---

---

## 📁 프로젝트 파일 구성

```text
18_kdt_01/
│
├─ app.py # Flask 서버 실행 및 API 제공
├─ requirements.txt # 프로젝트 실행에 필요한 Python 라이브러리 목록
├─ README.md # 프로젝트 소개 및 협업 방법
├─ .gitignore # Git에 올리지 않을 파일/폴더 설정
│
├─ data/ # 원본 데이터 및 전처리 결과 저장 폴더
│  ├─ 대구광역시 북구_데이터통합플랫폼_CCTV위치_20210630.csv
│  ├─ 대구광역시 북구_데이터통합플랫폼_불법주차_20201005.csv
│  ├─ 대구광역시 북구_불법주정차 민원_20211123.csv
│  ├─ 대구광역시 북구_불법주정차 상습 발생지 현장 정보_20211123.csv
│  ├─ 대구광역시 북구_불법주정차위반정보_20230704.csv
│  ├─ 대구광역시 북구_불법주정차위반정보_20231130.csv
│  ├─ 대구광역시 북구_불법주정차위반정보_20240603.csv
│  ├─ 대구광역시 북구_불법주정차위반정보_20260102.csv
│  │
│  └─ processed/ # 전처리·분석 후 생성된 결과 데이터
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
├─ notebooks/ # Jupyter Notebook 분석 코드
│  ├─ 01_preprocessing.ipynb # 원본 CSV 통합, 인코딩 처리, 날짜·시간·요일 전처리
│  ├─ 02_date_analysis.ipynb # 연도·월·요일 기준 날짜 분석
│  ├─ 03_time_analysis.ipynb # 시간대 및 요일×시간 교차 분석
│  ├─ 04_location_analysis.ipynb # 단속 장소 TOP10, 장소×시간, 연도별 추이 분석
│  ├─ 05_hotspot_analysis.ipynb # 민원·CCTV·상습 발생지역 분석
│  ├─ 06_final_analysis.ipynb # 최종 데이터 통합, 관리점수·백분위·관리등급 산정
│  │
│  └─ images/ # Notebook 분석 과정에서 생성한 그래프 이미지
│     └─ 분석 과정에서 생성된 시각화 이미지
│
├─ static/ # Flask 웹페이지에서 사용하는 정적 파일
│  ├─ css/
│  │  └─ lee_style2.css # 웹 대시보드 전체 UI 디자인
│  │
│  ├─ js/
│  │  └─ map.js # Leaflet 지도, 검색, 등급표시, CCTV·민원 레이어 기능
│  │
│  ├─ data/
│  │  ├─ bukgu_boundary.geojson  # 대구 북구 전체 외곽 경계 데이터
│  │  └─ bukgu_dong.geojson # 대구 북구 행정동 경계 데이터
│  │
│  └─ images/
│     ├─ final_grade_count.png
│     ├─ final_priority_score_heatmap.png
│     ├─ final_priority_top10.png
│     ├─ final_violation_complaint_scatter.png
│     ├─ hotspot_2025_enforcement_type.png
│     ├─ hotspot_dong_complaint_cctv.png
│     ├─ hotspot_location_map.png
│     ├─ hotspot_top10.png
│     ├─ location_top10_hour_heatmap.png
│     ├─ location_top10_places.png
│     └─ location_top10_year_trend.png
│
├─ templates/
│  └─ lee_index2.html # Flask에서 렌더링하는 메인 웹 대시보드 화면
│
├─ images/ # 최종 분석 그래프 일부 보관 폴더
│  ├─ final_grade_count.png
│  ├─ final_priority_score_heatmap.png
│  ├─ final_priority_top10.png
│  └─ final_violation_complaint_scatter.png
│
└─ docs/ # 프로젝트 문서 보관 폴더
   └─ lee_불법주정차_프로젝트_최종보고서.pdf

```

#### 팀 협업 안내  ####

아래 내용은 팀원 Git/GitHub 작업 방법입니다.


## 1. 시작하기 전에 (최초 1회만)

### 1-1. 저장소 받기
자기 컴퓨터에 프로젝트 폴더를 내려받습니다.

```bash
git clone https://github.com/zzengmo/18_kdt_01.git
cd 18_kdt_01
```

### 1-2. 내 정보 등록
깃허브에 어떤 이름으로 기록을 남길지 설정합니다. (컴퓨터 한 대당 한 번만 하면 됩니다)

```bash
git config --global user.name "내이름"
git config --global user.email "내깃허브이메일"
```


---

## 4. 매일 작업 순서 (제일 중요!)

작업할 때마다 아래 4줄을 **이 순서 그대로** 실행하세요.

```bash
# 1. 작업 시작 전 - 다른 사람이 올린 최신 내용 받아오기
git pull

# 2. (여기서 코딩 작업하기)

# 3. 작업 끝나면 - 바뀐 파일 담기
git add .

# 4. 메모 남기고 서버에 올리기
git commit -m "강서구 시간대별 분석 코드 추가"
git push
```

> ⚠️ **작업 시작 전 `git pull`을 안 하면 나중에 충돌이 날 수 있습니다. 꼭 먼저 실행하세요.**

---

## 5. 자주 쓰는 명령어 정리

| 명령어 | 설명 |
|---|---|
| `git pull` | 깃허브에 있는 최신 내용을 내 컴퓨터로 받기 |
| `git add .` | 바뀐 파일 전체를 커밋 준비 상태로 담기 |
| `git commit -m "설명"` | 담은 내용에 메모(무슨 작업인지) 남기기 |
| `git push` | 커밋한 내용을 깃허브 서버에 올리기 |
| `git status` | 지금 뭐가 바뀌었는지 확인하기 |
| `git log` | 지금까지의 커밋 기록 보기 |

---

## 6. 충돌(conflict)이 났을 때

- 같은 파일을 두 명이 동시에 고치면 충돌이 날 수 있습니다.
- **예방법**: 각자 자기 담당 파일만 수정하고, `utils.py`처럼 공통 파일을 고칠 때는 미리 단톡방에 알리기
- 충돌이 나면 당황하지 말고 단톡방에 공유 → 같이 해결


