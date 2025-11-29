import pickle
from datetime import datetime
import pandas as pd

# Model load
model = pickle.load(open("parking_predictor.sav", "rb"))
le = pickle.load(open("weather_encoder.sav", "rb"))

TOTAL_SLOTS = 120

# Bayram və xüsusi günləri təyin et (misal)
HOLIDAYS = ["2026-01-01", "2026-11-08", "2026-11-09", "2026-12-25"]  # format YYYY-MM-DD
SPECIAL_EVENTS = ["2026-03-20"]  # misal

# Weather dummy (sunny)
def get_weather_for_datetime(timestamp_str):
    return "sunny"

# Prediction funksiyası
def predict_parking(timestamp_str):
    dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M")
    weekday = dt.weekday() + 1
    hour = dt.hour
    minute = dt.minute
    is_weekend = 1 if weekday >= 6 else 0

    date_str = dt.strftime("%Y-%m-%d")
    holiday_flag = 1 if date_str in HOLIDAYS else 0
    special_flag = 1 if date_str in SPECIAL_EVENTS else 0

    weather = get_weather_for_datetime(timestamp_str)
    weather_encoded = le.transform([weather])[0]

    # Column sırası fit zamanı ilə eyni
    X = pd.DataFrame([{
        "weekday": weekday,
        "hour": hour,
        "minute": minute,
        "is_weekend": is_weekend,
        "weather_encoded": weather_encoded,
        "holiday_flag": holiday_flag,
        "special_event_flag": special_flag
    }], columns=[
        "weekday", "hour", "minute", "is_weekend",
        "weather_encoded", "holiday_flag", "special_event_flag"
    ])

    total_occupied = model.predict(X)[0]
    total_occupied = max(0, min(total_occupied, TOTAL_SLOTS))
    total_occupied = round(total_occupied)
    total_empty = TOTAL_SLOTS - total_occupied

    return {
        "timestamp": timestamp_str,
        "total_slots": TOTAL_SLOTS,
        "total_occupied": total_occupied,
        "total_empty": total_empty
    }

# Test nümunələri
test_times = [
    "2026-11-08 20:00",  # bayram günü
    "2026-11-09 20:30",  # bayram günü
    "2026-12-24 18:04",  # adi gün
]

for t in test_times:
    result = predict_parking(t)
    print(result)
