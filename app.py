from flask import Flask, jsonify, render_template, abort
import pandas as pd
import numpy as np
from pathlib import Path


# ==========================================================
# 1. Flask 설정
# ==========================================================

app = Flask(__name__)


# ==========================================================
# 2. 파일 경로 설정
# ==========================================================

# 현재 app.py가 있는 프로젝트 폴더
BASE_DIR = Path(__file__).resolve().parent

# 전처리된 데이터 폴더
DATA_DIR = BASE_DIR / "data" / "processed"

# 사용할 파일
REGION_FILE = DATA_DIR / "final_region_summary.csv"
OVERALL_FILE = DATA_DIR / "final_overall_summary.csv"
CCTV_FILE = DATA_DIR / "lee_cctv_location.csv"
HOTSPOT_FILE = DATA_DIR / "hotspot_clean.csv"
LOCATION_TOP10_FILE = DATA_DIR / "location_top10_summary.csv"


# ==========================================================
# 3. CSV 불러오기 함수
# ==========================================================

def load_csv(path):
    """
    CSV 파일을 utf-8-sig 방식으로 불러옵니다.
    파일이 없으면 오류를 발생시킵니다.
    """

    if not path.exists():
        raise FileNotFoundError(
            f"파일을 찾을 수 없습니다: {path}"
        )

    return pd.read_csv(
        path,
        encoding="utf-8-sig"
    )


# ==========================================================
# 4. 데이터 불러오기
# ==========================================================

region_df = load_csv(REGION_FILE)

overall_df = load_csv(OVERALL_FILE)

cctv_df = load_csv(CCTV_FILE)

hotspot_df = load_csv(HOTSPOT_FILE)


# 장소 TOP10은 없어도 서버가 실행되게 처리
if LOCATION_TOP10_FILE.exists():

    location_top10_df = load_csv(
        LOCATION_TOP10_FILE
    )

else:

    location_top10_df = pd.DataFrame()


# ==========================================================
# 5. JSON 변환 함수
# ==========================================================

def clean_value(value):
    """
    pandas / numpy 값을
    Flask JSON에서 사용할 수 있는 값으로 변환합니다.
    """

    # 결측값
    if pd.isna(value):
        return None

    # numpy 정수
    if isinstance(
        value,
        (np.integer,)
    ):
        return int(value)

    # numpy 실수
    if isinstance(
        value,
        (np.floating,)
    ):
        return float(value)

    # numpy bool
    if isinstance(
        value,
        (np.bool_,)
    ):
        return bool(value)

    # 날짜
    if isinstance(
        value,
        pd.Timestamp
    ):
        return value.isoformat()

    return value


def dataframe_to_records(df):
    """
    DataFrame 전체를
    JSON 배열 형태로 변환합니다.
    """

    records = []

    for row in df.to_dict(
        orient="records"
    ):

        cleaned_row = {}

        for key, value in row.items():

            cleaned_row[key] = clean_value(
                value
            )

        records.append(
            cleaned_row
        )

    return records


# ==========================================================
# 6. 메인 페이지
# ==========================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ==========================================================
# 7. 전체 북구 요약 API
# ==========================================================

@app.route("/api/summary")
def get_summary():

    if overall_df.empty:
        return jsonify({})

    summary = {}

    for key, value in (
        overall_df
        .iloc[0]
        .to_dict()
        .items()
    ):

        summary[key] = clean_value(
            value
        )

    return jsonify(
        summary
    )


# ==========================================================
# 8. 전체 동 데이터 API
# ==========================================================

@app.route("/api/regions")
def get_regions():

    return jsonify(
        dataframe_to_records(
            region_df
        )
    )


# ==========================================================
# 9. 특정 동 상세정보 API
# ==========================================================

@app.route(
    "/api/region/<dong_name>"
)
def get_region(dong_name):

    result = region_df[
        region_df["동"] == dong_name
    ]

    # 해당 동이 없는 경우
    if result.empty:

        abort(
            404,
            description=(
                f"{dong_name} 데이터를 "
                "찾을 수 없습니다."
            )
        )

    region = {}

    for key, value in (
        result
        .iloc[0]
        .to_dict()
        .items()
    ):

        region[key] = clean_value(
            value
        )

    return jsonify(
        region
    )


# ==========================================================
# 10. CCTV API
# ==========================================================

@app.route("/api/cctv")
def get_cctv():

    # 지도에서 필요한 컬럼
    columns = [
        "주소",
        "동",
        "설치목적구분",
        "위도",
        "경도",
        "데이터기준일자"
    ]

    # 실제 존재하는 컬럼만 사용
    columns = [
        col
        for col in columns
        if col in cctv_df.columns
    ]

    result = cctv_df[
        columns
    ].copy()

    # 지도에 찍을 수 없는 좌표 제거
    if (
        "위도" in result.columns
        and
        "경도" in result.columns
    ):

        result = result.dropna(
            subset=[
                "위도",
                "경도"
            ]
        )

    return jsonify(
        dataframe_to_records(
            result
        )
    )


# ==========================================================
# 11. 상습 민원지역 API
# ==========================================================

@app.route("/api/hotspots")
def get_hotspots():

    columns = [
        "주소",
        "짧은주소",
        "동",
        "민원발생누적건수",
        "민원2018",
        "민원2019",
        "민원2020",
        "민원2021",
        "위도",
        "경도",
        "현장사진수"
    ]

    # 실제 존재하는 컬럼만 선택
    columns = [
        col
        for col in columns
        if col in hotspot_df.columns
    ]

    result = hotspot_df[
        columns
    ].copy()

    # 좌표가 없는 데이터 제거
    if (
        "위도" in result.columns
        and
        "경도" in result.columns
    ):

        result = result.dropna(
            subset=[
                "위도",
                "경도"
            ]
        )

    return jsonify(
        dataframe_to_records(
            result
        )
    )


# ==========================================================
# 12. 장소 TOP10 API
# ==========================================================

@app.route("/api/location-top10")
def get_location_top10():

    if location_top10_df.empty:

        return jsonify([])

    return jsonify(
        dataframe_to_records(
            location_top10_df
        )
    )


# ==========================================================
# 13. 서버 상태 확인
# ==========================================================

@app.route("/api/health")
def health():

    return jsonify({

        "status":
            "ok",

        "region_rows":
            len(region_df),

        "cctv_rows":
            len(cctv_df),

        "hotspot_rows":
            len(hotspot_df)
    })


# ==========================================================
# 14. Flask 실행
# ==========================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )