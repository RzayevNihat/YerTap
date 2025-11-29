import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
import pickle

df = pd.read_excel("realistic_parking_data.xlsx")

# Encode weather
le = LabelEncoder()
df["weather_encoded"] = le.fit_transform(df["weather"])

# Features
X = df[[
    "weekday", "hour", "minute",
    "is_weekend", "weather_encoded",
    "holiday_flag", "special_event_flag"
]]

y = df["total_occupied"]

# Train-Test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Model
model = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    random_state=42
)

model.fit(X_train, y_train)

# Save model + labelencoder
pickle.dump(model, open("parking_predictor.sav", "wb"))
pickle.dump(le, open("weather_encoder.sav", "wb"))

print("MODEL TRAINED AND SAVED ✔")
