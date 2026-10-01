from flask import Flask, jsonify, render_template, abort
import pandas as pd
import numpy as np
from pathlib import Path


# ==========================================================
# 1. Flask 앱 생성
# ==========================================================

app = Flask(__name__)


# ==========================================================
# 2. 프로젝트 경로
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"


# 사용할 데이터
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
    CSV 파일을 utf-8-sig로 불러옵니다.
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

region_df = load_csv(
    REGION_FILE
)

overall_df = load_csv(
    OVERALL_FILE
)

cctv_df = load_csv(
    CCTV_FILE
)

hotspot_df = load_csv(
    HOTSPOT_FILE
)


# 장소 TOP10 파일은 없어도 서버 실행 가능
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
    pandas / numpy 자료형을
    JSON에서 사용할 수 있는 일반 Python 값으로 변환합니다.
    """

    # NaN / NaT
    if pd.isna(value):
        return None

    # numpy 정수
    if isinstance(value, np.integer):
        return int(value)

    # numpy 실수
    if isinstance(value, np.floating):
        return float(value)

    # numpy bool
    if isinstance(value, np.bool_):
        return bool(value)

    # pandas 날짜
    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    return value


def dataframe_to_records(df):
    """
    DataFrame을 JSON 배열로 변환합니다.
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
# 7. 전체 북구 분석 요약
# ==========================================================

@app.route("/api/summary")
def get_summary():

    if overall_df.empty:

        return jsonify({})

    summary = {}

    for key, value in (
        overall_df.iloc[0]
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
# 8. 전체 동 관리 결과
# ==========================================================

@app.route("/api/regions")
def get_regions():

    # 관리점수가 높은 순서
    result = region_df.sort_values(
        "관리점수",
        ascending=False
    )

    return jsonify(
        dataframe_to_records(
            result
        )
    )


# ==========================================================
# 9. 특정 동 상세정보
# ==========================================================

@app.route("/api/region/<dong_name>")
def get_region(dong_name):

    result = region_df[
        region_df["동"] == dong_name
    ]

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
        result.iloc[0]
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
# 10. 관리 우선순위 상위 / 하위
# ==========================================================

@app.route("/api/ranking")
def get_ranking():

    sorted_df = region_df.sort_values(
        "관리점수",
        ascending=False
    )

    top5 = sorted_df.head(5)

    bottom5 = sorted_df.tail(5).sort_values(
        "관리점수",
        ascending=True
    )

    return jsonify({

        "top5":
            dataframe_to_records(
                top5
            ),

        "bottom5":
            dataframe_to_records(
                bottom5
            )
    })


# ==========================================================
# 11. CCTV 위치
# ==========================================================

@app.route("/api/cctv")
def get_cctv():

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


    # 좌표 없는 행 제거
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
# 12. 상습 민원지역
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


    columns = [

        col

        for col in columns

        if col in hotspot_df.columns

    ]


    result = hotspot_df[
        columns
    ].copy()


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
# 13. 장소 TOP10
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
# 14. 서버 상태 확인
# ==========================================================

@app.route("/api/health")
def health():

    return jsonify({

        "status":
            "ok",

        "regions":
            len(region_df),

        "cctv":
            len(cctv_df),

        "hotspots":
            len(hotspot_df),

        "geojson_expected":
            "/static/data/bukgu_dong.geojson"

    })


# ==========================================================
# 15. 실행
# ==========================================================

if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=5000,

        debug=True

    )