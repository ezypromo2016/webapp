# Security Specification for CBKPOS

## Data Invariants
1. **Transactions**: Every transaction must have a valid `transactionNumber`, `total` amount, `items` list, and `created_at` timestamp. It must be authored by a logged-in user.
2. **Printing Records**: Must have `customerName`, `amount`, and `created_at`.
3. **Credits**: Must have `borrower_name`, `principal_amount`, and `created_at`. Only admins/cashiers can view the full registry. Individual borrowers can only see their own records if they have their `borrower_id`.
4. **Products**: Must have `name`, `price`, and `stock`.

## The "Dirty Dozen" Payloads (Targeting Firestore Rules)

### 1. Anonymous Access (Identity)
**Action**: `get /transactions/any` without auth header.
**Expectation**: `PERMISSION_DENIED`.

### 2. Unverified Email (Identity)
**Action**: `create /transactions` with valid auth but `email_verified: false`.
**Expectation**: `PERMISSION_DENIED`.

### 3. Identity Spoofing (Integrity)
**Action**: `create /transactions` with `userId` field set to a different user's UID.
**Expectation**: `PERMISSION_DENIED`.

### 4. Shadow Fields (Integrity)
**Action**: `create /products` with an extra field `isPromoted: true` not in official schema.
**Expectation**: `PERMISSION_DENIED` (due to `hasOnly` on keys).

### 5. Large Document Injection (Resource Exhaustion)
**Action**: `create /printing_records` where `customerName` is a 1MB string.
**Expectation**: `PERMISSION_DENIED` (due to `.size()` limits).

### 6. Invalid Status Shortcut (State)
**Action**: `update /credits/{id}` to set `status: 'paid'` without updating `balance_amount: 0`.
**Expectation**: `PERMISSION_DENIED` (due to atomic validation).

### 7. Unauthorized Range Query (PII Isolation)
**Action**: `list /users` as a standard cashier.
**Expectation**: `PERMISSION_DENIED`.

### 8. Orphaned Document (Relational Sync)
**Action**: `create /transactions` with `items` referencing a non-existent `productId`.
**Expectation**: `PERMISSION_DENIED` (due to `exists()` check).

### 9. Price Tampering (Integrity)
**Action**: `create /transactions` where `total` does not match the sum of `items`.
**Expectation**: `PERMISSION_DENIED`.

### 10. Timestamp Forgery (Temporal Integrity)
**Action**: `create /printing_records` with `created_at` set to a future date.
**Expectation**: `PERMISSION_DENIED` (must use `request.time`).

### 11. Resource Poisoning (ID Poisoning)
**Action**: `create /credits/{id}` where `{id}` is a 1.5KB junk string.
**Expectation**: `PERMISSION_DENIED` (due to `isValidId()` check on path).

### 12. Self-Promotion (Privilege Escalation)
**Action**: `update /users/{myId}` to set `role: 'admin'`.
**Expectation**: `PERMISSION_DENIED`.
