"""Database models will be added here."""
from app.models.assignment import Assignment, AssignmentReport, Rubric, Submission
from app.models.course import ClassGroup, Course, CourseMembership
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument, KnowledgeDocumentVersionRecord
from app.models.plan import Competition, LearningPlan, TeamRecommendation
from app.models.profile import CapabilityEvidence, CapabilityProfile, StudentProfileRecord
from app.models.task import AgentTask, LearningTaskRecord
from app.models.user import User

__all__ = [
    "AgentTask",
    "Assignment",
    "AssignmentReport",
    "CapabilityEvidence",
    "CapabilityProfile",
    "ClassGroup",
    "Competition",
    "Course",
    "CourseMembership",
    "KnowledgeChunk",
    "KnowledgeDocument",
    "KnowledgeDocumentVersionRecord",
    "LearningPlan",
    "LearningTaskRecord",
    "Rubric",
    "Submission",
    "StudentProfileRecord",
    "TeamRecommendation",
    "User",
]
