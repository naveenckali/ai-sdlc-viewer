# Design Document: CSV export

## Overview

A `GET /orders/export.csv` endpoint streams the user's orders as CSV.

## Components

- `OrderExporter`: turns order rows into CSV lines.
