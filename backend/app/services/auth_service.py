from __future__ import annotations

from app.schemas.auth import DemoAccount, DemoAccountsResponse, DemoSessionResponse


class AuthService:
    accounts = [
        DemoAccount(
            user_id="student_001",
            name="林一舟",
            role="student",
            title="学生演示账号",
            default_view="growth",
            authorized_courses=["Web 应用开发", "算法设计与分析"],
            authorized_classes=["2024 级计算机科学与技术 1 班"],
            modules=["学生报告", "成长路径", "知识库问答"],
        ),
        DemoAccount(
            user_id="teacher_001",
            name="周老师",
            role="teacher",
            title="教师演示账号",
            default_view="teacher",
            authorized_courses=["Web 应用开发"],
            authorized_classes=["2024 级计算机科学与技术 1 班"],
            modules=["教师看板", "学生报告", "知识库问答"],
        ),
        DemoAccount(
            user_id="admin_001",
            name="平台管理员",
            role="admin",
            title="管理员演示账号",
            default_view="kb",
            authorized_courses=["全部演示课程"],
            authorized_classes=["全部演示班级"],
            modules=["知识库管理", "教师看板", "成长路径", "知识库问答"],
        ),
    ]

    def list_demo_accounts(self) -> DemoAccountsResponse:
        return DemoAccountsResponse(accounts=self.accounts)

    def create_demo_session(self, user_id: str) -> DemoSessionResponse:
        account = self._find_account(user_id)
        return DemoSessionResponse(
            token=f"demo-token-{account.user_id}",
            account=account,
            expires_in=60 * 60 * 8,
        )

    def _find_account(self, user_id: str) -> DemoAccount:
        for account in self.accounts:
            if account.user_id == user_id:
                return account
        return self.accounts[0]
