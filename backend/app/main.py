from fastapi import FastAPI

app = FastAPI(
    title="GeoTales API",
    description="GPS Tour Guide API",
    version="1.0.0",
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