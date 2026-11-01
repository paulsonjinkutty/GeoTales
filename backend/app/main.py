
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router

app = FastAPI(
    title="GeoTales API",
    description="GPS Tour Guide API",
    version="1.0.0",
)

# Allow the local Next.js frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all versioned API endpoints.
app.include_router(
    api_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {"message": "GeoTales API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
