---
config:
  look: handDrawn
---

sequenceDiagram
autonumber
participant User as User (Inst/Stud)
participant LMS
participant UI as Next.js App (UI + API)
participant DB as Postgres (Sequelize)
participant Testlify as Testlify API

    Note over User, LMS: Phase 1: Authentication & Launch
    User->>LMS: Clicks LTI Link
    LMS->>UI: POST /api/lti/launch (id_token)
    UI->>UI: Validate Token & Context (ltijs)
    UI-->>LMS: Redirect to Dashboard (w/ ltik)
    LMS->>UI: Load Dashboard (iframe)

    Note over UI, Testlify: Phase 2: Instructor Assignment
    UI->>UI: GET /api/me (Auth header)
    UI-->>UI: Return User Info & Roles

    alt Instructor Role
        par Fetch Data
            UI->>UI: GET /api/assessments
            UI->>Testlify: Fetch Available Assessments
            Testlify-->>UI: JSON List
            UI-->>UI: Assessments Data
        and
            UI->>UI: GET /api/members
            UI->>LMS: Names & Roles Service (NRPS)
            LMS-->>UI: Course Roster
            UI-->>UI: Student List
        end

        User->>UI: Selects Assessment & Students
        UI->>UI: POST /api/assignments
        UI->>DB: Wipe old & Bulk Create AssessmentAssignment
        UI-->>UI: Success

        UI->>UI: POST /api/invite-candidates
        UI->>Testlify: POST /assessment/candidate/invites
        Testlify-->>UI: OK
        UI-->>UI: Invites Sent
    end

    Note over Testlify, LMS: Phase 3: Grading & Writeback (Webhook)
    Testlify->>UI: POST /api/webhook/score
    UI->>UI: Verify x-webhook-secret
    UI->>DB: Find Assignment (Email + AssessID)
    DB-->>UI: Assignment (PlatformId, LineItemUrl)
    loop For Each Matched Assignment
        UI->>LMS: Request Access Token (Scope: AGS)
        LMS-->>UI: OAuth2 Token
        UI->>LMS: GET LineItem (Check existence)
        alt LineItem Missing
            UI->>LMS: POST LineItem (Create new column)
            LMS-->>UI: New LineItem ID
        end
        UI->>LMS: POST /scores (Submit Grade)
        LMS-->>UI: 200 OK
    end
    UI-->>Testlify: 200 OK (Acknowledged)
