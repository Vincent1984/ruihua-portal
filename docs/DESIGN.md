# Design Document: Form Management & Permission Isolation

## 1. Overview
This document outlines the architecture for decoupling the Form Management (Appointment) system from the RBAC Permission Management system. The goal is to ensure that form operations are robust and not blocked by granular permission configuration errors, while maintaining basic authentication security.

## 2. Architecture

### 2.1 Current State (Coupled)
- **Routes**: Defined in `server.js` mixed with other modules.
- **Middleware**: Uses `requirePerm('appointment:xxx')` which checks detailed role permissions.
- **Dependency**: If a user's role is missing specific permission strings (e.g., `appointment:list`), the feature breaks entirely.

### 2.2 New State (Decoupled)
- **Storage**: Independent MongoDB Collection `appointments` (managed by `models/Appointment.js`).
- **Access Control**: 
  - **Public**: POST `/api/appointments` (No Auth).
  - **Admin**: GET/PUT/DELETE `/api/appointments/*` (Basic `authRequired` only).
- **Isolation**: Removed `requirePerm` middleware from appointment routes. Any logged-in admin can manage forms. This fulfills the requirement: "Form operations should not trigger permission validation logic (except basic login state validation)".

## 3. Database Schema (ER)

### Appointment Collection
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Primary Key |
| name | String | User Name |
| phone | String | Phone Number |
| company | String | Company Name |
| title | String | Job Title |
| problem | String | Problem Description |
| source | String | Source Page |
| utm_* | String | UTM Parameters |
| status | String | Status (new, contacted, closed) |
| createdAt | Date | Timestamp |

*Note: No foreign keys to Permission or Role tables.*

## 4. API Specification

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/appointments | None | Public form submission |
| GET | /api/appointments | Token | List appointments (All admins) |
| PUT | /api/appointments/:id | Token | Update status (All admins) |
| DELETE | /api/appointments/:id | Token | Delete record (All admins) |
| GET | /api/appointments/export | Token | Export CSV (All admins) |

## 5. Verification Plan
1. **Public Submission**: Verify `POST` works without token.
2. **Admin Access**: Verify `GET` works with a valid token (regardless of role permissions).
3. **Isolation**: Verify `GET` works even if the user has a role with NO permissions (but valid login).

