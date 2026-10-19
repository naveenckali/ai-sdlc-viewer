# Search brief

Purpose: let shoppers find products by name or category from the header search box.

## Inputs

- The product catalog in the `products` table

## Outputs

- A ranked list of matching products, 20 per page

## Steps for the implementing agent

- [ ] 1. Add a `GET /search?q=` endpoint that matches on name and category
- [ ] 2. Rank exact name matches first
- [ ] 3. Wire the header search box to the endpoint
