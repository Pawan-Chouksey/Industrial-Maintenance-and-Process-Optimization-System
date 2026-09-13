import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "InfosysSpringboard")

client = MongoClient(MONGO_URL)
db     = client[DB_NAME]

# Collections
users_collection = db["users"]

# Ensure username and email are unique
try:
    users_collection.create_index("username", unique=True)
    users_collection.create_index("email", unique=True)
except Exception:
    pass

