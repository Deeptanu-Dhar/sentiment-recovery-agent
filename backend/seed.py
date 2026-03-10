import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

patients = [
    {"patientId": f"PAT-{1900+i}", "name": name, "phone": f"+9190000{1000+i}",
     "department": dept, "billingStatus": "Paid",
     "surveyStatus": "not_sent", "createdAt": datetime.utcnow()}
    for i, (name, dept) in enumerate([
        ("Arjun Sharma", "Emergency"), ("Priya Nair", "Cardiology"),
        ("Ravi Kumar", "Orthopedics"), ("Sneha Iyer", "Emergency"),
        ("Mohammed Ali", "Neurology"), ("Deepa Menon", "Cardiology"),
        ("Karthik Raja", "General Ward"), ("Anita Singh", "Emergency"),
        ("Suresh Babu", "Orthopedics"), ("Lakshmi Devi", "General Ward"),
    ])
]

managers = [
    {"managerId": "MGR-001", "name": "Dr. Priya Sharma", "role": "Duty Manager",
     "department": None, "phone": "+919000000001", "isOnDuty": True,
     "notificationPreference": ["push"], "createdAt": datetime.utcnow()},
    {"managerId": "MGR-002", "name": "Dr. Ramesh Nair", "role": "Department Head",
     "department": "Emergency", "phone": "+919000000002", "isOnDuty": True,
     "notificationPreference": ["push", "email"], "createdAt": datetime.utcnow()},
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME] # type: ignore

    await db.patients.delete_many({})
    await db.managers.delete_many({})

    await db.patients.insert_many(patients)
    await db.managers.insert_many(managers)

    print(f"✅ Seeded {len(patients)} patients and {len(managers)} managers")
    client.close()

asyncio.run(seed())