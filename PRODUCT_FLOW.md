# Product Flow Diagrams

## 1. High-Level User Journey

The following flowchart outlines the major steps for Instructors, Students, and the System, covering Setup, Assignment Creation, and Grading.

```mermaid
graph TD
    %% Nodes
    subgraph "Setup Phase"
        Admin[LMS Admin] -->|Registers| LTI[LTI Tool]
        LTI -->|Dynamic Reg| Reg[Platform Registration]
    end

    subgraph "Instructor Workflow"
        Inst[Instructor] -->|Launches| UI[LTI Dashboard]
        UI -->|API Call| T_API[Testlify API]
        UI -->|LTI Service| NRPS[LMS Roster]

        T_API -->|Returns| Assess[Assessments List]
        NRPS -->|Returns| Studs[Student List]

        Inst -->|Selects| AS[Assessment + Students]
        AS -->|Action| Invite[Send Invites]
        Invite -->|Trigger| DB_Map[Save Mapping to DB]
        Invite -->|Trigger| T_Invite[Testlify Invitation]
    end

    subgraph "Student Workflow"
        Student[Student] -->|Launches| S_UI[LTI Dashboard]
        S_UI -->|Checks| DB_Map
        DB_Map -->|Found| Link[Testlify Test Link]
        Link -->|Clicks| Take[Take Assessment]
    end

    subgraph "Grading (Automated)"
        Take -->|Completes| Score[Score Generated]
        Score -->|Webhook| Server[LTI Server]
        Server -->|Lookup| DB_Map
        Server -->|LTI AGS| Grade[LMS Gradebook]
        Grade -->|Update| G_View[Student Grade]
    end

    %% Styles
    style Admin fill:#f9f,stroke:#333
    style Inst fill:#bbf,stroke:#333
    style Student fill:#bfb,stroke:#333
    style Server fill:#fbb,stroke:#333
```

## 2. Technical Sequence Diagram

This diagram visualizes exactly how the code (Controllers & APIs) executes these flows, detailing the interaction between the Client, Server, Database, LMS, and Testlify.

```mermaid
sequenceDiagram
    autonumber
    participant User as User (Inst/Stud)
    participant LMS
    participant UI as LTI Client (Next.js)
    participant Server as LTI Server (Express)
    participant DB as Postgres (Sequelize)
    participant Testlify as Testlify API

    Note over User, LMS: Phase 1: Authentication & Launch
    User->>LMS: Clicks LTI Link
    LMS->>Server: POST /lti/launch (id_token)
    Server->>Server: Validate Token & Context
    Server-->>LMS: Redirect to UI (w/ ltik)
    LMS->>UI: Load Dashboard (iframe)

    Note over UI, Testlify: Phase 2: Instructor Assignment
    UI->>Server: GET /api/me (Auth header)
    Server-->>UI: Return User Info & Roles

    alt Instructor Role
        par Fetch Data
            UI->>Server: GET /api/assessments
            Server->>Testlify: Fetch Available Assessments
            Testlify-->>Server: JSON List
            Server-->>UI: Assessments Data
        and
            UI->>Server: GET /api/members
            Server->>LMS: Names & Roles Service (NRPS)
            LMS-->>Server: Course Roster
            Server-->>UI: Student List
        end

        User->>UI: Selects Assessment & Students
        UI->>Server: POST /api/assignments
        Server->>DB: Wipe old & Bulk Create AssessmentAssignment
        Server-->>UI: Success

        UI->>Server: POST /api/invite-candidates
        Server->>Testlify: POST /assessment/candidate/invites
        Testlify-->>Server: OK
        Server-->>UI: Invites Sent
    end

    Note over Testlify, LMS: Phase 3: Grading & Writeback (Webhook)
    Testlify->>Server: POST /api/webhook/score
    Server->>Server: Verify x-webhook-secret
    Server->>DB: Find Assignment (Email + AssessID)
    DB-->>Server: Assignment (PlatformId, LineItemUrl)

    loop For Each Matched Assignment
        Server->>LMS: Request Access Token (Scope: AGS)
        LMS-->>Server: OAuth2 Token

        Server->>LMS: GET LineItem (Check existence)
        alt LineItem Missing
            Server->>LMS: POST LineItem (Create new column)
            LMS-->>Server: New LineItem ID
        end

        Server->>LMS: POST /scores (Submit Grade)
        LMS-->>Server: 200 OK
    end

    Server-->>Testlify: 200 OK (Acknowledged)
```

## Key Components

- **LTI Server (`server.ts`, `index.ts`)**: Handles the handshake and `onConnect`.
- **API Controller (`apiController.ts`)**: Bridges the frontend with Testlify and the LMS (NRPS).
- **Webhook Controller (`webhookController.ts`)**: The critical piece for grade passback. It blindly accepts scores from Testlify and maps them back to the LMS user via the `AssessmentAssignment` database table.
- **Database (`AssessmentAssignment` model)**: Acts as the "Glue" holding the state between the LTI Context (Course), the LMS User, and the Testlify Assessment ID.
