# Implementation Plan: Email login

**Spec**: [spec.md](./spec.md)

## Technical Context

- Language: TypeScript on Node 20
- Storage: PostgreSQL `users` table with a bcrypt password hash

## Approach

Add a `POST /login` route that checks the hash and sets a session cookie.
