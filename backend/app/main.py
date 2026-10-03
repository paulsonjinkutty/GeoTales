from fastapi import FastAPI
from app.api.v1.router import api_router

app = FastAPI(
    title="GeoTales API",
    description="GPS Tour Guide API",
    version="1.0.0",
    )

app.include_router(
    api_router,
    prefix="/api/v1",
)

@app.get("/")
def root():
    return{
    "message":"GeoTales API is running"
    }

@app.get("/heath")
def health_check():
    return{
    "status":"healthy"
    }