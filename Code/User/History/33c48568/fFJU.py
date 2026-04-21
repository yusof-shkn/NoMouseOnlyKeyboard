"""tests/test_auth.py — POST /auth/*"""
import pytest

from tests.conftest import auth_headers, register_user, unique


# ---------------------------------------------------------------------------
# Register`
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_with_email_returns_tokens(client):
    data = await register_user(client)
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_with_phone_only(client):
    phone = "+256700000001"
    uname = unique("phone")
    resp = await client.post(
        "/auth/register",
        json={"username": uname, "phone_number": phone, "password": "Password123!"},
    )
    assert resp.status_code == 201
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_register_duplicate_username_returns_409(client):
    data = await register_user(client)
    resp = await client.post(
        "/auth/register",
        json={
            "username": data["username"],
            "email": f"other_{unique()}@example.com",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 409
    assert "Username" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client):
    data = await register_user(client)
    resp = await client.post(
        "/auth/register",
        json={
            "username": unique("user"),
            "email": data["email"],
            "password": "Password123!",
        },
    )
    assert resp.status_code == 409
    assert "Email" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_no_contact_returns_422(client):
    resp = await client.post(
        "/auth/register",
        json={"username": unique("user"), "password": "Password123!"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password_returns_422(client):
    resp = await client.post(
        "/auth/register",
        json={"username": unique("user"), "email": "x@x.com", "password": "short"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_by_email(client):
    data = await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"identifier": data["email"], "password": data["password"]},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_by_phone(client):
    phone = f"+25670{unique('n')[:7]}"
    uname = unique("phonelogin")
    await client.post(
        "/auth/register",
        json={"username": uname, "phone_number": phone, "password": "Password123!"},
    )
    resp = await client.post(
        "/auth/login", json={"identifier": phone, "password": "Password123!"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    data = await register_user(client)
    resp = await client.post(
        "/auth/login",
        json={"identifier": data["email"], "password": "WrongPass999!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_identifier_returns_401(client):
    resp = await client.post(
        "/auth/login",
        json={"identifier": "nobody@nowhere.com", "password": "Password123!"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refresh_returns_new_tokens(client):
    data = await register_user(client)
    resp = await client.post(
        "/auth/refresh", json={"refresh_token": data["refresh_token"]}
    )
    assert resp.status_code == 200
    new_data = resp.json()
    assert "access_token" in new_data
    # Rotated — new refresh token should differ from the old one.
    assert new_data["refresh_token"] != data["refresh_token"]


@pytest.mark.asyncio
async def test_refresh_with_invalid_token_returns_401(client):
    resp = await client.post(
        "/auth/refresh", json={"refresh_token": "this.is.not.valid"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_reusing_old_refresh_token_after_rotation_returns_401(client):
    data = await register_user(client)
    old_refresh = data["refresh_token"]
    # Rotate
    await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    # Re-use the now-consumed token
    resp = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_logout_returns_204(client):
    data = await register_user(client)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    resp = await client.post(
        "/auth/logout",
        json={"refresh_token": data["refresh_token"]},
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_logout_without_auth_returns_401(client):
    resp = await client.post("/auth/logout")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_change_password_success(client):
    data = await register_user(client)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    resp = await client.post(
        "/auth/change-password",
        json={"current_password": data["password"], "new_password": "NewPassword456!"},
        headers=headers,
    )
    assert resp.status_code == 204
    # Confirm new password works for login.
    login_resp = await client.post(
        "/auth/login",
        json={"identifier": data["email"], "password": "NewPassword456!"},
    )
    assert login_resp.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current_returns_400(client):
    data = await register_user(client)
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    resp = await client.post(
        "/auth/change-password",
        json={"current_password": "WrongOld!", "new_password": "NewPassword456!"},
        headers=headers,
    )
    assert resp.status_code == 400
