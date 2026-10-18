# Feature Specification: Email login

**Feature Branch**: `001-login`
**Status**: Draft

## Goal

Let a returning user sign in with their email address and a password.

## User Scenarios

1. A user with an account enters their email and password and lands on their dashboard.
2. A user who enters a wrong password sees an error and can try again.

## Requirements

- **FR-001**: The system MUST lock an account for 15 minutes after 5 failed attempts.
- **FR-002**: The system MUST NOT reveal whether an email address has an account.
