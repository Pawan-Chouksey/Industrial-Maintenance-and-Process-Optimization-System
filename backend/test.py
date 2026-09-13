from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME")]

# Try inserting a test document
db["test"].insert_one({"hello": "atlas"})
print("✅ MongoDB Atlas connected successfully!")