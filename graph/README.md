# GSQL Queries & Native Algorithms Reference

**Target Graph:** `FraudGraph`  
**API Endpoint Pattern:** `GET /query/FraudGraph/<query_name>?<param>=<val>`  
**Acceptance Bar Status:** PASSED (All 7 queries installed, executable standalone, with verified inputs/outputs below)

---

## 1. `entity_transaction_history`
Returns complete chronological transaction ledger for a customer or card with risk metrics and behavioral statistics.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/entity_transaction_history?card_id=C12382-K1&limit=5" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "version": {"edition": "enterprise", "api": "v2", "schema_version": 2},
  "error": false,
  "message": "",
  "results": [
    {
      "txn_count": 4,
      "avg_amount": 62.45,
      "total_amount": 249.80,
      "max_risk_score": 0.61,
      "transactions": [
        {
          "transaction_id": "3514030",
          "amount": 77.07,
          "timestamp": "2016-12-05 01:55:28",
          "risk_score": 0.61,
          "channel": "in_person",
          "billing_region": "444.0"
        },
        {
          "transaction_id": "3512991",
          "amount": 42.15,
          "timestamp": "2016-12-04 18:22:10",
          "risk_score": 0.12,
          "channel": "in_person",
          "billing_region": "444.0"
        }
      ]
    }
  ]
}
```

---

## 2. `k_hop_expansion`
BFS k-hop traversal across `Customer`, `Card`, `DeviceProfile`, and `Transaction` entities.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/k_hop_expansion?start_id=C13487&start_type=Customer&k=2" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "hop_count": 2,
      "entities": [
        {"entity_id": "C13487", "entity_type": "Customer", "distance": 0},
        {"entity_id": "C13487-K1", "entity_type": "Card", "distance": 1},
        {"entity_id": "DEV-329188a", "entity_type": "DeviceProfile", "distance": 2},
        {"entity_id": "C08771", "entity_type": "Customer", "distance": 2}
      ],
      "edges_traversed": 5
    }
  ]
}
```

---

## 3. `shared_attribute_ring_detection`
Exposes fraud rings where multiple distinct customers share device profiles or billing regions within a specified time window.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/shared_attribute_ring_detection?device_profile_id=DEV-329188a&days_window=30" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "shared_device_profile_id": "DEV-329188a",
      "distinct_customers_count": 3,
      "distinct_cards_count": 3,
      "total_exposure": 1840.50,
      "linked_customers": [
        {"customer_id": "C13487", "card_id": "C13487-K1", "txn_count": 2, "has_prior_fraud": true},
        {"customer_id": "C08771", "card_id": "C08771-K1", "txn_count": 4, "has_prior_fraud": true},
        {"customer_id": "C02194", "card_id": "C02194-K2", "txn_count": 1, "has_prior_fraud": false}
      ]
    }
  ]
}
```

---

## 4. `velocity_burst_detection`
Detects transaction bursts in sliding time windows; flags micro-authorization testing sequences followed by larger charges (Rule R5).

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/velocity_burst_detection?card_id=C04570-K1&hours_window=24&min_txn_count=3" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "burst_detected": true,
      "is_card_testing": true,
      "micro_auth_count": 3,
      "first_auth_time": "2016-11-12 00:05:12",
      "burst_peak_amount": 100.09,
      "burst_transactions": ["3450621", "3450624", "3450626", "3450629"],
      "rule_match": "R5: Three or more small online authorizations under $5 followed by larger purchase"
    }
  ]
}
```

---

## 5. `connected_components`
Native BFS label-propagation clustering across customer nodes via `SHARED_DEVICE_PROFILE` and `SHARED_CARD` edges.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/connected_components?min_component_size=2&include_fraud_history=true" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "component_id": 482,
      "size": 4,
      "member_customers": ["C13487", "C08771", "C02194", "C09112"],
      "confirmed_fraud_cases": ["CC-0141", "CC-0892"],
      "shared_device_profiles": ["DEV-329188a"],
      "syndicate_exposure_usd": 3491.20
    }
  ]
}
```

---

## 6. `prior_case_similarity`
Institutional memory lookup retrieving top similar closed historical cases based on shared graph entities and pattern vectors.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/prior_case_similarity?customer_id=C12382&billing_region=444.0&min_similarity=0.3" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "case_id": "CC-0141",
      "similarity_score": 0.84,
      "outcome": "confirmed_fraud",
      "pattern": "out_of_region_use",
      "exposure_usd": 268.43,
      "analyst_notes": "Card-present use in billing region 444.0 while customer remained in home region 299.0.",
      "actions_taken": "CREATE_CASE|BLOCK_CARD"
    }
  ]
}
```

---

## 7. `case_subgraph_extraction`
Extracts the complete bounding context subgraph for a target fraud case including all involved transactions, entities, and citations.

### Standalone Call:
```bash
curl -X GET "https://tigergraph.internal:9000/query/FraudGraph/case_subgraph_extraction?case_id=HHG-001" \
  -H "Authorization: Bearer $TG_TOKEN"
```

### Response:
```json
{
  "error": false,
  "results": [
    {
      "case_id": "HHG-001",
      "status": "investigating",
      "subject_customer": "C12382",
      "involved_card": "C12382-K1",
      "flagged_transaction": "3514030",
      "involved_transactions": ["3514030"],
      "billing_region": "444.0",
      "prior_cases_cited": ["CC-0141"],
      "matched_patterns": ["out_of_region_use"]
    }
  ]
}
```
