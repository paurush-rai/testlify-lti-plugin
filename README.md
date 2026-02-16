# LTI Tool — Next.js (Consolidated)

This project is a Learning Tools Interoperability (LTI) 1.3 tool built as a single Next.js application. It integrates `ltijs` within the Next.js App Router to provide a seamless full-stack experience without a separate backend server.

## Features

- **Standard Next.js App Router**: Backend logic resides in `app/api` routes.
- **LTI 1.3 + Advantage**: Full support for LTI 1.3 launches, Names and Roles Provisioning, and Assignment and Grade Services.
- **Integrated Database**: Uses `sequelize` with PostgreSQL.
- **Serverless Ready**: Designed to deploy on Vercel or any Node.js environment.

## Getting Started

The entire application is contained within the `ui-client` directory.

1.  Navigate to the project directory:

    ```bash
    cd ui-client
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Configure Environment Variables (`.env`):
    - `LTI_KEY`: Encryption key for `ltijs`.
    - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`: Database credentials.
    - `TESTLIFY_API_KEY`: API key for external service integration.

4.  Run Development Server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## API Routes

- `/api/lti/*`: Handles all LTI protocol requests (Launch, Login, JWKS).
- `/api/me`: Returns current user context.
- `/api/assessments`: Fetches available assessments.
- `/api/assignments`: Manages course assignments.
