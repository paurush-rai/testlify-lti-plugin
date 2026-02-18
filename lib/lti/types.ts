/** LTI 1.3 Advantage type definitions */

/** Registered LMS platform record (mirrors lti_platforms table) */
export interface Platform {
  id: string; // MongoDB ObjectId string
  issuer: string;
  client_id: string;
  deployment_id: string | null;
  auth_login_url: string;
  auth_token_url: string;
  keyset_url: string;
  created_at?: Date;
  updated_at?: Date;
}

/** LTI context (course) claim */
export interface LtiContext {
  id: string;
  title?: string;
  label?: string;
  type?: string[];
}

/** AGS endpoint info embedded in id_token */
export interface AgsEndpoint {
  lineitems: string;
  lineitem?: string;
  scope: string[];
}

/** NRPS endpoint info embedded in id_token */
export interface NrpsEndpoint {
  context_memberships_url: string;
  service_versions: string[];
}

/** Claims extracted from the LTI id_token and stored in the session JWT */
export interface SessionPayload {
  /** LMS user id (sub claim) */
  sub: string;
  name: string;
  email: string;
  roles: string[];
  context: LtiContext;
  /** Platform reference for OAuth2 */
  issuer: string;
  clientId: string;
  deploymentId?: string;
  platformId: string;
  /** AGS endpoints (if granted) */
  ags?: AgsEndpoint;
  /** NRPS endpoint (if granted) */
  nrps?: NrpsEndpoint;
  /** JWT standard fields */
  iat?: number;
  exp?: number;
}

/** OIDC state JWT payload — used as the `state` param in the auth redirect */
export interface StatePayload {
  nonce: string;
  platformId: string;
  iat?: number;
  exp?: number;
}

/** JWK public key representation (RSA) */
export interface JwkRsa {
  kty: "RSA";
  kid: string;
  n: string;
  e: string;
  alg: "RS256";
  use: "sig";
}

/** JWKS response shape */
export interface JwksResponse {
  keys: JwkRsa[];
}

/** OAuth2 token response from platform */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/** NRPS member from the platform */
export interface NrpsMember {
  user_id: string;
  name?: string;
  email?: string;
  roles: string[];
  status?: string;
}

/** AGS LineItem */
export interface LineItem {
  id: string;
  scoreMaximum: number;
  label: string;
  tag?: string;
  resourceId?: string;
  resourceLinkId?: string;
}

/** AGS Score submission */
export interface Score {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  timestamp: string;
  activityProgress:
    | "Initialized"
    | "Started"
    | "InProgress"
    | "Submitted"
    | "Completed";
  gradingProgress:
    | "FullyGraded"
    | "Pending"
    | "PendingManual"
    | "Failed"
    | "NotReady";
}

/** OpenID configuration returned by the LMS during dynamic registration */
export interface OpenIdConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  claims_supported?: string[];
  "https://purl.imsglobal.org/spec/lti-platform-configuration"?: {
    product_family_code?: string;
    messages_supported?: Array<{
      type: string;
      placements?: string[];
    }>;
    variables?: string[];
  };
}

/** Tool registration request sent during dynamic registration */
export interface ToolRegistration {
  application_type: "web";
  response_types: string[];
  grant_types: string[];
  initiate_login_uri: string;
  redirect_uris: string[];
  client_name: string;
  jwks_uri: string;
  logo_uri?: string;
  token_endpoint_auth_method: "private_key_jwt";
  scope: string;
  "https://purl.imsglobal.org/spec/lti-tool-configuration": {
    domain: string;
    description?: string;
    target_link_uri: string;
    claims: string[];
    messages: Array<{
      type: string;
      target_link_uri: string;
      label?: string;
      placements?: string[];
    }>;
  };
}

/** Platform registration response during dynamic registration */
export interface RegistrationResponse {
  client_id: string;
  response_types: string[];
  jwks_uri: string;
  initiate_login_uri: string;
  grant_types: string[];
  redirect_uris: string[];
  application_type: string;
  token_endpoint_auth_method: string;
  client_name: string;
  logo_uri?: string;
  scope: string;
  "https://purl.imsglobal.org/spec/lti-tool-configuration": {
    domain: string;
    description?: string;
    target_link_uri: string;
    deployment_id: string;
    claims: string[];
    messages: Array<{
      type: string;
      target_link_uri: string;
      label?: string;
      placements?: string[];
    }>;
  };
}
