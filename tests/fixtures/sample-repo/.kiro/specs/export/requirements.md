# Requirements Document: CSV export

## Introduction

Users need to export their order history as a CSV file.

## Requirements

### Requirement 1

**User Story:** As a shopper, I want to download my orders as CSV, so that I can track spending in a spreadsheet.

#### Acceptance Criteria

1. WHEN the user clicks Export THEN the system SHALL download a CSV with one row per order.
2. IF the user has no orders THEN the system SHALL download a CSV with only the header row.
