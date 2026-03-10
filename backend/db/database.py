from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    MONGO_URI: str
    MONGO_DB_NAME: str
    GEMINI_API_KEY: str
    TWILIO_ACCOUNT_SID: str = Field(default="", validation_alias=AliasChoices("TWILIO_ACCOUNT_SID", "SID"))
    TWILIO_AUTH_TOKEN: str = Field(default="", validation_alias=AliasChoices("TWILIO_AUTH_TOKEN", "TOKEN"))
    TWILIO_WHATSAPP_FROM: str = Field(default="whatsapp:+14155238886", validation_alias=AliasChoices("TWILIO_WHATSAPP_FROM", "SANDBOX_NUMBER"))
    HOSPITAL_NAME: str = "Hospital Management Team"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings() # type: ignore

client: AsyncIOMotorClient = None # type: ignore

async def connect_db():
    global client
    settings = get_settings()
    client = AsyncIOMotorClient(settings.MONGO_URI)
    print(f"✅ Connected to MongoDB: {settings.MONGO_DB_NAME}")

async def close_db():
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed")

def get_db():
    settings = get_settings()
    return client[settings.MONGO_DB_NAME]