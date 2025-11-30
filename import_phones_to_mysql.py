import json
import mysql.connector
import math

# -------------------------------------------------------------
# IMPORT JUMIA PHONES INTO MYSQL
# Table: phones
# -------------------------------------------------------------

JSON_FILE = "jumia_phones.json"

# --- Helper to clean NaN safely ---
def safe(value):
    """Convert NaN, None, or undefined to empty string."""
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value)

# --- Load JSON file ---
try:
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        phones = json.load(f)
except Exception as e:
    print(f"❌ Error loading {JSON_FILE}: {e}")
    exit()

print(f"📄 Loaded {len(phones)} phone items from {JSON_FILE}")

# --- Connect to MySQL ---
try:
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",      
        database="dailysmart"
    )
    cursor = conn.cursor()
    print("✅ Connected to MySQL!")
except mysql.connector.Error as err:
    print(f"❌ Database connection error: {err}")
    exit()

# --- Insert data ---
sql = """
    INSERT INTO phones (name, price, old_price, rating, image_url, product_link)
    VALUES (%s, %s, %s, %s, %s, %s)
"""

count = 0

for item in phones:
    try:
        cursor.execute(sql, (
            safe(item.get("name")),
            safe(item.get("price")),
            safe(item.get("old_price")),
            safe(item.get("rating")),
            safe(item.get("image_url")),
            safe(item.get("product_link")),
        ))
        count += 1
    except mysql.connector.Error as err:
        print(f"⚠️ Error inserting item: {err}")

conn.commit()
cursor.close()
conn.close()

print(f"\n🎉 IMPORT COMPLETE!")
print(f"📦 Successfully inserted: {count} phone products")
