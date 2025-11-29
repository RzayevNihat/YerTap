import pickle
from datetime import datetime
import pandas as pd

# ======================
# 1️⃣ Parking B modeli və weather encoder
# ======================
model = pickle.load(open("parking_b_model.sav", "rb"))
le = pickle.load(open("parking_b_weather_encoder.sav", "rb"))

TOTAL_SLOTS = 30  # Parking B üçün

# ======================
# 2️⃣ Prediction funksiyası
# ======================
def predict_parking_b(timestamp_str, holiday_flag=0, special_flag=0):
    dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M")
    weekday = dt.weekday() + 1
    hour = dt.hour
    minute = dt.minute
    is_weekend = 1 if weekday >= 6 else 0

    # Weather backend API ilə təmin olunacaq, burada sadəcə placeholder
    weather = "sunny"
    weather_encoded = le.transform([weather])[0]

    X_input = pd.DataFrame([{
        "weekday": weekday,
        "hour": hour,
        "minute": minute,
        "is_weekend": is_weekend,
        "holiday_flag": holiday_flag,
        "special_event_flag": special_flag,
        "weather_encoded": weather_encoded
    }])

    total_occupied = model.predict(X_input)[0]
    total_occupied = max(0, min(total_occupied, TOTAL_SLOTS))
    total_occupied = round(total_occupied)
    total_empty = TOTAL_SLOTS - total_occupied

    return {
        "timestamp": timestamp_str,
        "total_slots": TOTAL_SLOTS,
        "total_occupied": total_occupied,
        "total_empty": total_empty
    }

# ======================
# 3️⃣ Test nümunələri
# ======================
if __name__ == "__main__":
    test_times = [
        "2025-12-25 12:00",  # Bayram
        "2025-12-26 10:30",  # Normal gün
        "2026-01-01 15:00"   # Bayram
    ]

    for t in test_times:
        result = predict_parking_b(t, holiday_flag=1)
        print(result)
