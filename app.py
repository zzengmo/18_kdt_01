from flask import Flask, jsonify, render_template, abort
import pandas as pd
import numpy as np
from pathlib import Path

app = Flask(__name__)

# --------------------------------------------------
# 1. 프로젝트 경로 설정
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"

REGION_FILE = DATA_DIR / "final_region_summary.csv"
OVERALL_FILE = DATA_DIR / "final_overall_summary.csv"
CCTV_FILE = DATA_DIR / "lee_cctv_location.csv"
HOTSPOT_FILE = DATA_DIR / "hotspot_clean.csv"
LOCATION_TOP10_FILE = DATA_DIR / "location_top10_summary.csv"


# --------------------------------------------------
# 2. CSV 불러오기
# --------------------------------------------------
def load_csv(path):
    """
    utf-8-sig로 CSV를 불러오는 공통 함수
    파일이 없으면 서버 시작 시 바로 알 수 있도록 에러 발생
    """
    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path}")

    return pd.read_csv(path, encoding="utf-8-sig")


region_df = load_csv(REGION_FILE)
overall_df = load_csv(OVERALL_FILE)
cctv_df = load_csv(CCTV_FILE)
hotspot_df = load_csv(HOTSPOT_FILE)

if LOCATION_TOP10_FILE.exists():
    location_top10_df = load_csv(LOCATION_TOP10_FILE)
else:
    location_top10_df = pd.DataFrame()


# --------------------------------------------------
# 3. JSON 변환용 정리 함수
# --------------------------------------------------
def clean_value(value):
    """
    pandas / numpy 값을 JSON에서 사용할 수 있는 일반 Python 값으로 변환
    NaN, NaT는 None으로 변환
    """
    if pd.isna(value):
        return None

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.floating,)):
        return float(value)

    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()

    return value


def dataframe_to_records(df):
    """
    DataFrame을 JSON 응답에 안전한 records 형식으로 변환
    """
    records = []

    for row in df.to_dict(orient="records"):
        cleaned = {
            key: clean_value(value)
            for key, value in row.items()
        }
        records.append(cleaned)

    return records


# --------------------------------------------------
# 4. 메인 페이지
# --------------------------------------------------
@app.route("/")
def index():
    """
    templates/index.html을 보여주는 메인 페이지
    """
    return render_template("index.html")


# --------------------------------------------------
# 5. 전체 북구 요약 API
# --------------------------------------------------
@app.route("/api/summary")
def get_summary():
    """
    대구 북구 전체 분석 요약
    """
    if overall_df.empty:
        return jsonify({})

    summary = {
        key: clean_value(value)
        for key, value in overall_df.iloc[0].to_dict().items()
    }

    return jsonify(summary)


# --------------------------------------------------
# 6. 전체 동 분석결과 API
# --------------------------------------------------
@app.route("/api/regions")
def get_regions():
    """
    모든 동의 분석결과 반환
    지도 마커 생성에 사용
    """
    return jsonify(dataframe_to_records(region_df))


# --------------------------------------------------
# 7. 특정 동 상세정보 API
# --------------------------------------------------
@app.route("/api/region/<dong_name>")
def get_region(dong_name):
    """
    예:
    /api/region/산격동
    /api/region/동천동
    """
    result = region_df[region_df["동"] == dong_name]

    if result.empty:
        abort(404, description=f"{dong_name} 데이터를 찾을 수 없습니다.")

    region = {
        key: clean_value(value)
        for key, value in result.iloc[0].to_dict().items()
    }

    return jsonify(region)


# --------------------------------------------------
# 8. CCTV 위치 API
# --------------------------------------------------
@app.route("/api/cctv")
def get_cctv():
    """
    지도 CCTV 레이어용 데이터
    """
    columns = [
        col for col in
        ["주소", "동", "설치목적구분", "위도", "경도", "데이터기준일자"]
        if col in cctv_df.columns
    ]

    result = cctv_df[columns].copy()

    # 좌표가 없는 행은 지도에 사용할 수 없으므로 제외
    if "위도" in result.columns and "경도" in result.columns:
        result = result.dropna(subset=["위도", "경도"])

    return jsonify(dataframe_to_records(result))


# --------------------------------------------------
# 9. 상습 민원지역 API
# --------------------------------------------------
@app.route("/api/hotspots")
def get_hotspots():
    """
    상습 민원지역 지도 레이어용 데이터
    """
    columns = [
        col for col in
        [
            "주소", "짧은주소", "동", "민원발생누적건수",
            "민원2018", "민원2019", "민원2020", "민원2021",
            "위도", "경도", "현장사진수"
        ]
        if col in hotspot_df.columns
    ]

    result = hotspot_df[columns].copy()

    if "위도" in result.columns and "경도" in result.columns:
        result = result.dropna(subset=["위도", "경도"])

    return jsonify(dataframe_to_records(result))


# --------------------------------------------------
# 10. 장소 TOP10 API
# --------------------------------------------------
@app.route("/api/location-top10")
def get_location_top10():
    """
    장소 TOP10 분석 결과
    """
    if location_top10_df.empty:
        return jsonify([])

    return jsonify(dataframe_to_records(location_top10_df))


# --------------------------------------------------
# 11. 서버 상태 확인 API
# --------------------------------------------------
@app.route("/api/health")
def health():
    """
    서버 및 핵심 데이터 로딩 상태 확인
    """
    return jsonify({
        "status": "ok",
        "region_rows": len(region_df),
        "cctv_rows": len(cctv_df),
        "hotspot_rows": len(hotspot_df)
    })


# --------------------------------------------------
# 12. 실행
# --------------------------------------------------
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
