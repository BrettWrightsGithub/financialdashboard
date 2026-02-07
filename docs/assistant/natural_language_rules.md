# Natural Language Rules

## Endpoint
- `POST /api/assistant/parse-rule`

## Request
```json
{
  "message": "Categorize Starbucks under $15 as Coffee"
}
```

## Response Shapes
- Parsed rule:
```json
{
  "rule": {
    "name": "starbucks -> coffee",
    "match_merchant_contains": "Starbucks",
    "match_amount_max": 15,
    "match_direction": "outflow",
    "assign_category_name": "Coffee",
    "assign_category_id": "uuid"
  }
}
```
- Clarification request:
```json
{
  "clarification": "I need both a merchant pattern and a destination category"
}
```
- Missing provider key (safe failure):
```json
{
  "response": "LLM provider is set to OpenAI but OPENAI_API_KEY is not configured."
}
```

## Environment Variables
- `LLM_PROVIDER` (`openai` or `anthropic`, default `openai`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4o-mini`)
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional)

## Notes
- Rule parsing uses model-first parsing with regex fallback for resilience.
- Category assignment is validated against existing categories before returning a save-ready rule.
