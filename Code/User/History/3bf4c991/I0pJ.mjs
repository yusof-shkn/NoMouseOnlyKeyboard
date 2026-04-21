Let me go back through all the source files carefully before giving you an answer.Now I have the full picture. Let me lay out every real issue I found:---

This flow has **real problems**. Some are design gaps, some are actual bugs. Here's everything, ranked by severity:

---

## 🔴 Critical — Bugs / Broken Logic

**1. The `insurance_verification` order status is a ghost status**

Nothing in the entire frontend ever sets an order to `insurance_verification`. The only button on `prescription_uploaded` is "Start Pharmacy Review" which jumps directly to `pharmacy_review`. The status exists in the type definitions, it shows in labels and filters, the pharmacy dashboard groups it alongside pending orders — but no action ever produces it. Either it gets set by a Supabase DB trigger (not visible from frontend code), or it's dead code from an older version of the flow. The document I wrote shows it as a real step. It may not be.

**2. Pricing math bug for insured orders — delivery fee is always charged to insurance**

In `savePricing`, for insured orders:
```js
insuredAmount = insuredMedAmount + deliveryFeeCalc  // delivery included in what insurance pays
totalAmount   = cashMedAmount                        // customer pays ONLY cash meds
```
The delivery fee (UGX 10,000) is silently added to `insuredAmount` — meaning insurance is assumed to always cover delivery. If the patient's insurance scheme doesn't cover delivery, the math is wrong and the customer effectively gets free delivery at the insurance company's expense with no transparency.

**3. Insurance coverage override doesn't recalculate `total_amount`**

When insurance staff approve and override the `insured_amount` to a lower figure, the display in the modal correctly recalculates what the customer should pay. But `total_amount` in the DB was set by the pharmacy's original calculation. The `approve_insurance_coverage` RPC may or may not update `total_amount` — if it doesn't, the customer at the payment screen pays the old pharmacy-calculated amount, not the correct post-override amount. This is a silent financial discrepancy.

---

## 🟠 Significant — Missing Paths / Wrong Documentation

**4. Walk-in / No-Rider path is entirely missing from the flow**

There is a complete third delivery path that the document doesn't mention at all. When the pharmacist selects "No Rider / Walk-in" at dispatch:
- `dispatched` status is **skipped entirely**
- Order jumps directly from `packing` → `out_for_delivery`
- `no_rider = true` is set on the order
- **No OTP is generated, no QR scan is required**
- The order is marked delivered manually by the pharmacist

This is a significant path (walk-in customer picks up at pharmacy counter) with zero security check at handover.

**5. Pharmacist can reprice after `awaiting_confirmation`**

The "Save Pricing" button is available when order status is `pharmacy_review`, `pricing_ready`, or `awaiting_confirmation`. That last one means the pharmacist can change prices while the customer is actively looking at the breakdown deciding whether to pay. The customer has no indication that the pricing changed under them. If they confirm payment at the old price, the totals in the DB are immediately stale.

**6. Insurance approval routing is not based on `selected_insurance_id`**

The insurance approvals screen finds orders by:
1. Getting all `profile_id`s where `provider = my_company_name AND status = verified`
2. Finding orders in those profiles with `status = pricing_ready`

It never uses `selected_insurance_id` (the specific insurance record the customer chose at upload). If a patient has insurance from two providers (e.g. works changed jobs, has two active cards), both companies can see and approve the same order. Whichever company approves first wins.

---

## 🟡 Minor — Gaps & Technical Debt

**7. No auto-routing on upload — all orders land in one bucket**

There is no automatic transition from `prescription_uploaded`. A pharmacist must manually click "Start Pharmacy Review" on every single order regardless of whether it has insurance or not. An insured order and a cash order look identical in the queue. There's no prioritisation, SLA, or auto-assignment.

**8. `insurance_coverage_log` is written from the frontend after the RPC**

The log insert happens as a separate client call after `approve_insurance_coverage` RPC. If the network drops between the two calls, the approval happens in the DB but the audit log is empty. The audit trail is incomplete with no retry mechanism.

**9. Broadcast timeout has no automatic fallback**

`broadcast_timeout_at` is set when broadcasting to riders. When the 5-minute window expires, the UI shows an alert to the pharmacist. But there's no automatic status rollback, no escalation, and no notification to the pharmacy manager. The order stays stuck in `packing` with expired delivery requests until the pharmacist manually reassigns.

**10. Support staff role is completely absent from the flow**

There's a full support portal (`SupportDashboard`, `SupportLogin`) with escalation handling. Support staff can intervene in orders. This actor is entirely missing from the documented flow.

**11. `prescription_url` vs `prescription_urls` legacy dual-storage**

Every upload writes to both `prescription_url` (single path, first image only) and `prescription_urls` (all images). The comment in the code even says "backward compat". This means all DB queries, reports, and any downstream processing that only reads `prescription_url` silently miss images 2, 3, 4… if a customer uploaded multiple pages of a prescription.

---

**Summary of what I got wrong in the document:**
- `insurance_verification` described as a real active step → it might be a ghost
- Walk-in path doesn't exist in the doc at all
- Insurance routing described as clean and accurate → it's actually fuzzy (provider name match, not ID)
- Pricing shown as set-once → pharmacist can revise after customer sees it
- Delivery fee shown as customer-pays → it's silently baked into insurance's amount

Want me to update the doc with the corrected flow, or tackle any of these bugs in the code first?
