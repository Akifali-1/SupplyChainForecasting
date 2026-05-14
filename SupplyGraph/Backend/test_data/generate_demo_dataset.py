"""
Generate a demo supply chain dataset with intentional trends:
  - 6 products GROWING (clear upward trend in last 60 days)
  - 5 products DECLINING (clear downward trend)
  - 6 products STABLE (flat with normal noise)

Same format as realworld_single_dataset.csv:
  Date, Plant, node1, node2, PRODUCT_1, PRODUCT_2, ...
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

np.random.seed(42)

# Config
DAYS = 730  # 2 years of data
STORES = [
    ("PLANT_WEST", "DIST_CA", "Walmart_Supercenter_Dallas"),
    ("PLANT_WEST", "DIST_WA", "Target_Downtown_Seattle"),
    ("PLANT_EAST", "DIST_NY", "BestBuy_Fifth_Ave_NYC"),
    ("PLANT_MIDWEST", "DIST_IL", "Costco_Wholesale_Chicago"),
    ("PLANT_WEST", "DIST_CA", "Apple_Store_Union_Square_SF"),
    ("PLANT_SOUTH", "DIST_TX", "Target_Austin"),
    ("PLANT_SOUTH", "DIST_FL", "Walmart_Miami_Beach"),
    ("PLANT_EAST", "DIST_MA", "BestBuy_Boston"),
]

# Products with their trend direction and base demand
PRODUCTS = {
    # GROWING products (6) — clear upward trend last 60 days
    "IPHONE_14_PRO":       {"base": 1200, "trend": "up",     "growth_rate": 0.0025},
    "MACBOOK_AIR_13":      {"base": 1400, "trend": "up",     "growth_rate": 0.0020},
    "APPLE_WATCH_SERIES_9":{"base": 1100, "trend": "up",     "growth_rate": 0.0030},
    "NIKE_AIR_MAX":        {"base": 1300, "trend": "up",     "growth_rate": 0.0015},
    "REDBULL_250ML":       {"base": 1800, "trend": "up",     "growth_rate": 0.0022},
    "AMAZON_ECHO_DOT":     {"base": 800,  "trend": "up",     "growth_rate": 0.0035},

    # DECLINING products (5) — clear downward trend last 60 days
    "GALAXY_S23":          {"base": 900,  "trend": "down",   "growth_rate": -0.0020},
    "XBOX_SERIES_X":       {"base": 300,  "trend": "down",   "growth_rate": -0.0030},
    "ADIDAS_ULTRABOOST":   {"base": 1000, "trend": "down",   "growth_rate": -0.0018},
    "SPRITE_330ML":        {"base": 600,  "trend": "down",   "growth_rate": -0.0025},
    "LEVIS_501_JEANS":     {"base": 500,  "trend": "down",   "growth_rate": -0.0022},

    # STABLE products (6) — flat with normal variation
    "PLAYSTATION_5":       {"base": 900,  "trend": "stable", "growth_rate": 0.0},
    "NINTENDO_SWITCH":     {"base": 1600, "trend": "stable", "growth_rate": 0.0},
    "COCA_COLA_330ML":     {"base": 400,  "trend": "stable", "growth_rate": 0.0},
    "PEPSI_330ML":         {"base": 600,  "trend": "stable", "growth_rate": 0.0},
    "SONY_WH_1000XM5":     {"base": 1100, "trend": "stable", "growth_rate": 0.0},
    "LAYS_CLASSIC":        {"base": 700,  "trend": "stable", "growth_rate": 0.0},
}

start_date = datetime(2023, 1, 1)
rows = []

for day_idx in range(DAYS):
    date = start_date + timedelta(days=day_idx)

    for plant, dist, store in STORES:
        row = {
            "Date": date.strftime("%Y-%m-%d"),
            "Plant": plant,
            "node1": dist,
            "node2": store,
        }

        # Store-level multiplier (some stores are bigger)
        store_mult = {
            "Walmart_Supercenter_Dallas": 0.7,
            "Target_Downtown_Seattle": 1.3,
            "BestBuy_Fifth_Ave_NYC": 0.8,
            "Costco_Wholesale_Chicago": 0.9,
            "Apple_Store_Union_Square_SF": 1.2,
            "Target_Austin": 0.75,
            "Walmart_Miami_Beach": 1.4,
            "BestBuy_Boston": 1.1,
        }.get(store, 1.0)

        for product, cfg in PRODUCTS.items():
            base = cfg["base"]
            rate = cfg["growth_rate"]
            trend = cfg["trend"]

            # For trending products, apply trend only in the last ~200 days
            # First 530 days are flat, last 200 days show the trend
            trend_start = DAYS - 200
            if day_idx < trend_start:
                # Flat period — seasonal + noise
                seasonal = 1.0 + 0.15 * np.sin(2 * np.pi * day_idx / 365)
                trend_mult = 1.0
            else:
                # Trending period
                days_into_trend = day_idx - trend_start
                seasonal = 1.0 + 0.10 * np.sin(2 * np.pi * day_idx / 365)
                trend_mult = (1.0 + rate) ** days_into_trend

            # Day-of-week effect (weekends slightly higher)
            dow = date.weekday()
            dow_mult = 1.15 if dow >= 5 else 1.0

            # Random noise (15-25% variation)
            noise = np.random.normal(1.0, 0.18)
            noise = max(0.3, noise)  # Floor to prevent negatives

            value = base * store_mult * seasonal * trend_mult * dow_mult * noise
            value = max(5.0, round(value, 1))  # Minimum 5 units

            row[product] = value

        rows.append(row)

df = pd.DataFrame(rows)

# Verify column order matches original
product_cols = list(PRODUCTS.keys())
col_order = ["Date", "Plant", "node1", "node2"] + product_cols
df = df[col_order]

output_path = "realworld_single_dataset.csv"
df.to_csv(output_path, index=False)

print(f"Generated {len(df)} rows × {len(df.columns)} columns")
print(f"Date range: {df['Date'].iloc[0]} to {df['Date'].iloc[-1]}")
print(f"Stores: {len(STORES)}")
print(f"Products: {len(PRODUCTS)}")
print(f"\nTrend breakdown:")
for name, cfg in PRODUCTS.items():
    print(f"  {cfg['trend']:>7s}  {name}  (base={cfg['base']}, rate={cfg['growth_rate']:+.4f})")

# Quick sanity check: compare first-30 vs last-30 day averages (aggregated across stores)
print(f"\nSanity check (aggregated daily avg, first 30d vs last 30d):")
dates = pd.to_datetime(df['Date'])
first_30 = df[dates <= dates.min() + timedelta(days=29)]
last_30 = df[dates >= dates.max() - timedelta(days=29)]

for p in product_cols:
    f_avg = first_30.groupby('Date')[p].sum().mean()
    l_avg = last_30.groupby('Date')[p].sum().mean()
    change = ((l_avg - f_avg) / f_avg * 100)
    arrow = "↑" if change > 5 else "↓" if change < -5 else "→"
    print(f"  {arrow} {p:25s}  first30={f_avg:>10.0f}  last30={l_avg:>10.0f}  change={change:+.1f}%")

print(f"\nSaved to: {output_path}")
