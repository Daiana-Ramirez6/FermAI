from fastapi import APIRouter
router = APIRouter(tags=["health"])

@router.get("/api/health")
def health():
    return {"ok": True, "service": "FermAI API"}
