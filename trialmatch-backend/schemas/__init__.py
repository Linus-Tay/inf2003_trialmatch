from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    """Request body used when a new user creates an account."""

    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Request body used for login."""

    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public user shape returned to the frontend."""

    user_id: int
    full_name: str
    email: EmailStr
    role_name: str


class AuthResponse(BaseModel):
    """Login/signup response containing the JWT token and user profile."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TrialCreate(BaseModel):
    """Request body for creating a new trial record."""

    nct_id: str = Field(min_length=3, max_length=30)
    brief_title: str = Field(min_length=3, max_length=500)
    official_title: str | None = None
    brief_summary: str | None = None
    phase_id: int | None = None
    status_id: int | None = None
    study_type_id: int | None = None
    sex_id: int | None = None
    minimum_age: int | None = Field(default=None, ge=0, le=120)
    maximum_age: int | None = Field(default=None, ge=0, le=120)
    healthy_volunteers: bool | None = None
    source_url: str | None = None


class TrialUpdate(BaseModel):
    """Request body for editing an existing trial record."""

    brief_title: str | None = Field(default=None, min_length=3, max_length=500)
    official_title: str | None = None
    brief_summary: str | None = None
    phase_id: int | None = None
    status_id: int | None = None
    study_type_id: int | None = None
    sex_id: int | None = None
    minimum_age: int | None = Field(default=None, ge=0, le=120)
    maximum_age: int | None = Field(default=None, ge=0, le=120)
    healthy_volunteers: bool | None = None
    source_url: str | None = None
    is_archived: bool | None = None


class TrialConditionAdd(BaseModel):
    """Request body for linking a condition to a trial."""

    condition_name: str = Field(min_length=2, max_length=255)
    condition_role: str = Field(default="Primary", max_length=50)


class TrialInterventionAdd(BaseModel):
    """Request body for linking an intervention to a trial."""

    intervention_name: str = Field(min_length=2, max_length=500)


class TrialCriteriaCreate(BaseModel):
    """Request body for creating a trial eligibility criteria row."""

    criteria_type: str = Field(default="General", max_length=50)
    criteria_text: str = Field(min_length=2)
    criteria_order: int = Field(default=1, ge=1)
    keyword_count: int = Field(default=0, ge=0)
    complexity_score: float | None = None
    requires_manual_review: bool = False


class TrialCriteriaUpdate(BaseModel):
    """Request body for editing a trial eligibility criteria row."""

    criteria_type: str | None = None
    criteria_text: str | None = None
    criteria_order: int | None = Field(default=None, ge=1)
    keyword_count: int | None = Field(default=None, ge=0)
    complexity_score: float | None = None
    requires_manual_review: bool | None = None


class PatientProfileCreate(BaseModel):
    """Request body for creating a patient profile used for matching."""

    profile_name: str = Field(min_length=2, max_length=150)
    age: int = Field(ge=0, le=120)
    sex_id: int
    condition_ids: list[int] = Field(default_factory=list)
    notes: str | None = None


class SavedTrialUpdate(BaseModel):
    """Request body for updating user-specific saved trial status and notes."""

    saved_status: str = Field(default="Saved", max_length=80)
    notes: str | None = None


class FlagResolveRequest(BaseModel):
    """Request body for resolving or reopening a data quality flag."""

    is_resolved: bool = True


class ParsedCriteriaItemCreate(BaseModel):
    """Request body for adding one nested criteria item to a MongoDB document."""

    criteria_type: str = Field(default="General", max_length=50)
    original_text: str = Field(min_length=2)
    keywords: list[str] = Field(default_factory=list)
    requires_manual_review: bool = False


class ParsedCriteriaItemUpdate(BaseModel):
    """Request body for editing one nested criteria item in MongoDB."""

    criteria_type: str | None = Field(default=None, max_length=50)
    original_text: str | None = Field(default=None, min_length=2)
    keywords: list[str] | None = None
    requires_manual_review: bool | None = None


class ParsedCriteriaDocumentReviewUpdate(BaseModel):
    """Request body for updating review metadata on a parsed criteria document."""

    status: str = Field(default="Needs Review", max_length=80)
    reviewer_note: str | None = None


class TrialConditionUpdate(BaseModel):
    """Request body for editing a trial-condition link."""

    condition_name: str | None = Field(default=None, min_length=2, max_length=255)
    condition_role: str | None = Field(default=None, max_length=50)


class TrialInterventionUpdate(BaseModel):
    """Request body for editing a trial-intervention link."""

    intervention_name: str | None = Field(default=None, min_length=2, max_length=500)