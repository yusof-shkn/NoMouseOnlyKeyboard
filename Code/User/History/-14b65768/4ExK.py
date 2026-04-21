"""app/main.py — Sawda Marketplace API v2."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ads.router import router as ads_router
from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.chat.router import router as chat_router
from app.follows.router import router as follows_router
from app.lifespan import lifespan
from app.notifications.router import router as notifications_router
from app.posts.router import router as posts_router
from app.privacy.router import router as privacy_router
from app.ratings.router import router as ratings_router
from app.search.router import router as search_router
from app.users.router import router as users_router

app = FastAPI(
    title="Sawda Marketplace API",
    description="Peer-to-peer marketplace — posts, chat, notifications, ads.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Adjust allow_origins for production (replace "*" with your frontend domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(follows_router)   # /users/{id}/follow, /followers, /following
app.include_router(ratings_router)   # /users/{id}/ratings
app.include_router(categories_router)
app.include_router(posts_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(privacy_router)
app.include_router(ads_router)
app.include_router(search_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok", "version": "2.0.0"}
