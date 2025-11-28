# n8n Workflow 4: AI Transaction Categorizer

**Purpose:** The "Brain" of the system. Looks for transactions without a category and assigns one using an LLM.

## Prerequisites
- **Supabase Credential:** Connection to your Supabase project.
- **OpenAI Credential:** API Key for GPT-4o or GPT-4-turbo.

## Node Configuration

### Node 1: Supabase Trigger (or Schedule)
- **Type:** Schedule (e.g., every 1 hour) or Webhook.
- **Purpose:** Check for uncategorized items.

### Node 2: Supabase (Get Uncategorized)
- **Type:** Supabase
- **Operation:** Get Many
- **Table:** `transactions`
- **Filter:** `life_category_id` IS NULL AND `category_locked` IS FALSE
- **Limit:** 20 (Batch process to avoid timeouts).

### Node 3: Supabase (Get Overrides Reference)
- **Type:** Supabase
- **Operation:** Get Many
- **Table:** `category_overrides`
- **Purpose:** Fetch recent manual fixes to inject into prompt as "few-shot" examples.

### Node 4: AI Agent / LLM Chain
- **Type:** LangChain / OpenAI
- **Model:** GPT-4o or GPT-4-turbo (needs high reasoning).
- **System Prompt:** (See `docs/ai/transaction_categorizer_v1.md`)
- **User Input:** JSON of the transaction from Node 2.
- **Expected Output:** JSON object only.
  ```json
  {
    "category_name": "Phone",
    "cashflow_group": "Fixed",
    "flow_type": "Expense",
    "is_pass_through": true
  }
  ```

### Node 5: Code Node (JSON Parser & Validator)
- **Type:** Code
- **Purpose:** Ensure LLM output is valid JSON and matches known categories.

### Node 6: Supabase (Look up Category ID)
- **Type:** Supabase
- **Operation:** Get Many
- **Table:** `categories`
- **Filter:** `name` = `{{ $json.category_name }}`
- **Purpose:** Get the UUID for the category name returned by AI.

### Node 7: Supabase (Update Transaction)
- **Type:** Supabase
- **Operation:** Update
- **Table:** `transactions`
- **Match Column:** `id`
- **Update Fields:**
  - `life_category_id`: `{{ $json.category_id }}`
  - `cashflow_group`: `{{ $json.cashflow_group }}`
  - `is_pass_through`: `{{ $json.is_pass_through }}`
  - `is_transfer`: `{{ $json.is_transfer }}`
  - `category_ai`: `{{ $json.category_name }}` (Store the name for reference)
  - `category_ai_conf`: 0.9 (Hardcoded or asked from LLM)
