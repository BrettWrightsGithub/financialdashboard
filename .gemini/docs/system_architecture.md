# Financial Command Center - System Architecture

```mermaid
graph TD
    %% --- External Services ---
    subgraph External_Services [External Data Providers]
        style External_Services fill:#f9f9f9,stroke:#333,stroke-dasharray: 5 5
        Teller[Teller API<br/>(Accounts/Txns)]
        Plaid[Plaid API<br/>(AFCU Checking)]
        Venmo[Gmail API<br/>(Venmo Receipts)]
    end

    %% --- Orchestration Layer ---
    subgraph Orchestration [Orchestration Layer]
        style Orchestration fill:#e1f5fe,stroke:#01579b
        n8n[n8n Automation Server]
    end

    %% --- Backend / Data Layer ---
    subgraph Backend [Supabase / Backend]
        style Backend fill:#e8f5e9,stroke:#1b5e20
        
        subgraph Database [PostgreSQL Schema]
            direction TB
            Accounts[Table: accounts]
            Transactions[Table: transactions]
            Categories[Table: categories]
            BudgetTargets[Table: budget_targets]
            Rules[Table: categorization_rules]
        end

        subgraph Logic [Stored Procedures / Logic]
            RPC_Cat[RPC: Categorization Waterfall]
            RPC_Safe[RPC: Safe-to-Spend Calc]
        end
    end

    %% --- Application Layer ---
    subgraph Frontend [Next.js Application]
        style Frontend fill:#fff3e0,stroke:#e65100
        
        subgraph Modules [Feature Modules]
            Dashboard[Dashboard<br/>/app/dashboard]
            Budget[Budget Planner<br/>/app/budget-planner]
            TxnList[Transactions<br/>/app/transactions]
            ReviewQ[Review Queue]
        end

        subgraph Libs [Libraries & Utilities]
            Lib_SB[lib/supabase.ts<br/>(Data Access)]
            Lib_CF[lib/cashflow.ts<br/>(Metric Calc)]
        end
    end

    %% --- Relationships ---

    %% Ingestion Flow
    Teller -->|Polls| n8n
    Plaid -->|Polls| n8n
    Venmo -->|Polls| n8n
    n8n -->|Normalizes & Writes| Transactions
    n8n -->|Updates| Accounts

    %% Database Internal Links (Conceptual "Class" Relations)
    Accounts -- 1:N --> Transactions
    Categories -- 1:N --> Transactions
    Categories -- 1:1 --> BudgetTargets
    Rules -- Applies to --> Transactions

    %% Backend Logic
    RPC_Cat -.->|Read/Write| Transactions
    RPC_Cat -.->|Read| Rules
    RPC_Safe -.->|Aggregates| Transactions
    RPC_Safe -.->|Aggregates| BudgetTargets

    %% Frontend Data Flow
    Dashboard -->|Uses| Lib_SB
    Budget -->|Uses| Lib_SB
    TxnList -->|Uses| Lib_SB
    ReviewQ -->|Uses| Lib_SB

    Dashboard -->|Uses| Lib_CF
    Budget -->|Uses| Lib_CF

    %% Frontend to Backend
    Lib_SB <-->|Query & RPC| Backend
```
