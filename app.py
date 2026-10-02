from flask import Flask, jsonify, render_template, abort
import pandas as pd
import numpy as np
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"

REGION_FILE = DATA_DIR / "final_region_summary.csv"
OVERALL_FILE = DATA_DIR / "final_overall_summary.csv"
CCTV_FILE = DATA_DIR / "lee_cctv_location.csv"
HOTSPOT_FILE = DATA_DIR / "hotspot_clean.csv"
LOCATION_TOP10_FILE = DATA_DIR / "location_top10_summary.csv"

def load_csv(path):
    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path}")
    return pd.read_csv(path, encoding="utf-8-sig")

region_df = load_csv(REGION_FILE)
overall_df = load_csv(OVERALL_FILE)
cctv_df = load_csv(CCTV_FILE)
hotspot_df = load_csv(HOTSPOT_FILE)
location_top10_df = load_csv(LOCATION_TOP10_FILE) if LOCATION_TOP10_FILE.exists() else pd.DataFrame()

def clean_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value

def dataframe_to_records(df):
    return [
        {key: clean_value(value) for key, value in row.items()}
        for row in df.to_dict(orient="records")
    ]

@app.route("/")
def index():
    return render_template("lee_index.html")

@app.route("/api/summary")
def get_summary():
    if overall_df.empty:
        return jsonify({})
    return jsonify({
        key: clean_value(value)
        for key, value in overall_df.iloc[0].to_dict().items()
    })

@app.route("/api/regions")
def get_regions():
    result = region_df.sort_values("관리점수", ascending=False)
    return jsonify(dataframe_to_records(result))

@app.route("/api/region/<dong_name>")
def get_region(dong_name):
    result = region_df[region_df["동"] == dong_name]
    if result.empty:
        abort(404, description=f"{dong_name} 데이터를 찾을 수 없습니다.")
    return jsonify({
        key: clean_value(value)
        for key, value in result.iloc[0].to_dict().items()
    })

@app.route("/api/ranking")
def get_ranking():
    sorted_df = region_df.sort_values("관리점수", ascending=False)
    return jsonify({
        "top5": dataframe_to_records(sorted_df.head(5)),
        "bottom5": dataframe_to_records(
            sorted_df.tail(5).sort_values("관리점수", ascending=True)
        )
    })

@app.route("/api/cctv")
def get_cctv():
    columns = [
        "주소", "동", "설치목적구분",
        "위도", "경도", "데이터기준일자"
    ]
    columns = [col for col in columns if col in cctv_df.columns]
    result = cctv_df[columns].copy()
    if "위도" in result.columns and "경도" in result.columns:
        result = result.dropna(subset=["위도", "경도"])
    return jsonify(dataframe_to_records(result))

@app.route("/api/hotspots")
def get_hotspots():
    columns = [
        "주소", "짧은주소", "동", "민원발생누적건수",
        "민원2018", "민원2019", "민원2020", "민원2021",
        "위도", "경도", "현장사진수"
    ]
    columns = [col for col in columns if col in hotspot_df.columns]
    result = hotspot_df[columns].copy()
    if "위도" in result.columns and "경도" in result.columns:
        result = result.dropna(subset=["위도", "경도"])
    return jsonify(dataframe_to_records(result))

@app.route("/api/location-top10")
def get_location_top10():
    if location_top10_df.empty:
        return jsonify([])
    return jsonify(dataframe_to_records(location_top10_df))

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "regions": len(region_df),
        "cctv": len(cctv_df),
        "hotspots": len(hotspot_df),
        "geojson_expected": "/static/data/bukgu_dong.geojson"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
