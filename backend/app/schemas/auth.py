from __future__ import annotations

from pydantic import BaseModel, Field


class DemoAccount(BaseModel):
    user_id: str
    name: str
    role: str
    title: str
    default_view: str
    authorized_courses: list[str] = Field(default_factory=list)
    authorized_classes: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)


class DemoAccountsResponse(BaseModel):
    accounts: list[DemoAccount]


class DemoSessionRequest(BaseModel):
    user_id: str


class LocalSessionRequest(BaseModel):
    user_id: str


class DemoSessionResponse(BaseModel):
    token: str
    account: DemoAccount
    expires_in: int
