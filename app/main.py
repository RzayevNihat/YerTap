# main.py
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime
import pickle
import pandas as pd
import requests
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # frontend allowed
    allow_credentials=True,
    allow_methods=["*"],  # allow POST, GET, etc
    allow_headers=["*"],  # allow Content-Type, Authorization, etc
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, "parking_predictor.sav")
encoder_path = os.path.join(BASE_DIR, "weather_encoder.sav")
model2 = pickle.load(open(os.path.join(BASE_DIR, "parking_b_model.sav"), "rb"))
encoder2 = pickle.load(open(os.path.join(BASE_DIR, "parking_b_weather_encoder.sav"), "rb"))
TOTAL_SLOTS_2 = 30
model = pickle.load(open(model_path, "rb"))
weather_encoder = pickle.load(open(encoder_path, "rb"))

TOTAL_SLOTS = 120

WEATHER_MAP = {
    "clear-day": "sunny",
    "clear-night": "sunny",
    "partly-cloudy-day": "cloudy",
    "partly-cloudy-night": "cloudy",
    "cloudy": "cloudy",
    "rain": "rain",
    "snow": "snow",
    "snow-showers-day": "snow",
    "snow-showers-night": "snow",
    "thunderstorm": "rain",
    "fog": "cloudy"
}

HOLIDAYS = ["2026-01-01", "2026-11-08", "2026-11-09", "2026-12-25"]
SPECIAL_EVENTS = ["2026-03-20"]

class DateRequest(BaseModel):
    date: str  # "YYYY-MM-DD HH:MM"

class SlotsResponse(BaseModel):
    id: int
    datetime: str
    total_slots: int
    total_occupied: int
    total_empty: int

@app.post("/slots", response_model=List[SlotsResponse])
def get_slots(request: DateRequest):

    try:
        dt = datetime.strptime(request.date, "%Y-%m-%d %H:%M")
    except:
        return SlotsResponse(
            datetime=request.date,
            total_slots=0,
            total_occupied=0,
            total_empty=0
        )

    date_str = dt.strftime("%Y-%m-%d")

    API_KEY = "ZXY7Q67T3BWC9C3NYSE4QR65Z"
    api_url = (
        f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"
        f"40.3766,49.8516/{date_str}"
        f"?unitGroup=metric&include=days&key={API_KEY}&contentType=json"
    )

    try:
        response = requests.get(api_url)
        weather_data = response.json()
        icon_raw = weather_data["days"][0].get("icon", "clear-day")
    except:
        icon_raw = "clear-day"

    weather_clean = WEATHER_MAP.get(icon_raw, "sunny")


    def run_model1():

        weather_encoded = weather_encoder.transform([weather_clean])[0]

        weekday = dt.weekday() + 1
        hour = dt.hour
        minute = dt.minute
        is_weekend = 1 if weekday >= 6 else 0
        holiday_flag = 1 if date_str in HOLIDAYS else 0
        special_flag = 1 if date_str in SPECIAL_EVENTS else 0

        X = pd.DataFrame([{
            "weekday": weekday,
            "hour": hour,
            "minute": minute,
            "is_weekend": is_weekend,
            "weather_encoded": weather_encoded,
            "holiday_flag": holiday_flag,
            "special_event_flag": special_flag
        }])

        try:
            total_occupied = model.predict(X)[0]
        except Exception as e:
            print("Model error:", e)
            return SlotsResponse(
                datetime=request.date,
                total_slots=0,
                total_occupied=0,
                total_empty=0
            )

        total_occupied = max(0, min(int(round(total_occupied)), TOTAL_SLOTS))
        total_empty = TOTAL_SLOTS - total_occupied

        return SlotsResponse(
            id=1,
            datetime=request.date,
            total_slots=TOTAL_SLOTS,
            total_occupied=total_occupied,
            total_empty=total_empty
        )
    def run_model2():
        weekday = dt.weekday() + 1
        hour = dt.hour
        minute = dt.minute
        is_weekend = 1 if weekday >= 6 else 0
        holiday_flag = 1 if date_str in HOLIDAYS else 0
        special_flag = 1 if date_str in SPECIAL_EVENTS else 0

        weather_encoded = int(encoder2.transform([weather_clean])[0])

        X = pd.DataFrame([{
            "weekday": weekday,
            "hour": hour,
            "minute": minute,
            "is_weekend": is_weekend,
            "holiday_flag": holiday_flag,
            "special_event_flag": special_flag,
            "weather_encoded": weather_encoded
        }])

        try:
            occupied = int(model2.predict(X)[0])
        except:
            occupied = 0

        occupied = max(0, min(occupied, TOTAL_SLOTS_2))
        empty = TOTAL_SLOTS_2 - occupied

        return SlotsResponse(
            id=2,
            datetime=request.date,
            total_slots=TOTAL_SLOTS_2,
            total_occupied=occupied,
            total_empty=empty
        )

    # 8) Response
    return [run_model1(), run_model2()]
