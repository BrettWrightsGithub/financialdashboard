Playwright MCP Testing Guidelines

For: Windsurf IDE AI Agents

Context: Use the playwright-mcp-server tools to verify UI functionality.

Goal: Move beyond static visual checks to robust, interaction-based testing.

1. About Playwright MCP

The Playwright MCP server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

Key Features

Fast and lightweight: Uses Playwright's accessibility tree, not pixel-based input.

LLM-friendly: No vision models needed, operates purely on structured data.

Deterministic tool application: Avoids ambiguity common with screenshot-based approaches.

Capabilities & Opt-ins

The server supports various capabilities (--caps):

Core automation: Standard interaction (clicks, fills).

Tab management: Handling multiple pages.

Coordinate-based: Opt-in via --caps=vision.

PDF generation: Opt-in via --caps=pdf.

Test assertions: Opt-in via --caps=testing.

Tracing: Opt-in via --caps=tracing.

2. Configuration & Setup

If you need to configure the server or understand its runtime environment:

Standard Config (windsurf / vs-code):

{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--limit-to-host=true" 
      ]
    }
  }
}


Common Arguments (args):

--headless: Run in headless mode (default).

--user-data-dir <path>: Persist browser profile (cookies/localStorage).

--storage-state <path>: Load auth state from a file.

--viewport-size <size>: e.g., "1280x720".

--caps <caps>: Enable additional features like vision or pdf.

Profiles:

Persistent: Stored in %USERPROFILE%\AppData\Local\ms-playwright\ (Windows) or ~/Library/Caches/ms-playwright/ (macOS/Linux).

Isolated: Use --isolated to wipe state between sessions.

3. Available MCP Tools & Usage

When executing tests, do not write a standalone .spec.ts file unless requested. Instead, use the available MCP tools directly to interact with the running local server.

Tool Name

Arguments

Purpose

playwright_navigate

{ url: string }

Open a URL. Waits for load event automatically.

playwright_screenshot

{ name: string, selector?: string, width?: number, height?: number }

Capture the state. Crucial for visual verification.

playwright_click

{ selector: string }

Click an element. Auto-waits for visibility/enablement.

playwright_fill

{ selector: string, value: string }

Fill input fields.

playwright_hover

{ selector: string }

Hover over an element (useful for tooltips/dropdowns).

playwright_evaluate

{ script: string }

Execute JavaScript in the browser console. Returns the result.

Selector Best Practices for MCP

Preferred: text="Submit" or button:has-text("Save") (User-facing)

Preferred: [placeholder="Enter name"] (Accessibility-facing)

Avoid: div > div:nth-child(3) > span (Brittle structure)

4. Testing Levels

Level 1: Visual Smoke Test

Objective: Ensure the page crashes are detected and layout is sane.

MCP Sequence:

playwright_navigate({ url: "http://localhost:3000" })

playwright_screenshot({ name: "homepage-load" })

Level 2: Interaction & State (REQUIRED for Forms/Buttons)

Objective: Verify that clicking things actually does something.

MCP Sequence:

playwright_navigate({ url: "http://localhost:3000/login" })

playwright_fill({ selector: "input[type='email']", value: "test@example.com" })

playwright_fill({ selector: "input[type='password']", value: "password123" })

playwright_click({ selector: "button:has-text('Sign In')" })

Verification: playwright_screenshot({ name: "dashboard-after-login" }) OR playwright_evaluate({ script: "window.location.href" })

Level 3: CRUD & Persistence (REQUIRED for Database Features)

Objective: Verify data survives a refresh.

MCP Sequence:

Create an item (using Level 2 steps).

playwright_navigate({ url: "http://localhost:3000/items" }) (Force refresh)

playwright_evaluate({ script: "document.body.innerText.includes('New Item Name')" })

If true, test passes.

5. Workflow Template for AI

When generating a plan for a new feature, strict adherence to this testing structure is required in the final step.

Template to insert into Plan:

## Verification Phase (Playwright MCP)

1. **Setup:**
   - [ ] Navigate to `[Target URL]`
   - [ ] Screenshot: Initial state

2. **Interaction Loop:**
   - [ ] Fill `[Input Name]` with `[Test Value]`
   - [ ] Click `[Button Name]`
   - [ ] Screenshot: Capture immediate UI feedback (toast/modal)

3. **Persistence Check:**
   - [ ] Reload the page
   - [ ] Evaluate: Check if `[Test Value]` is present in the DOM/API
   - [ ] Cleanup: Delete the test entity (if applicable)



6. Common Pitfalls & Solutions

Issue

Symptom

MCP Solution

Race Conditions

Screenshot is taken before data loads.

Use playwright_evaluate to wait for a specific element count before screenshotting, or rely on playwright_click's auto-wait.

Obscured Elements

playwright_click fails because a toast/modal covers the button.

Wait for the overlay to disappear or close it first.

Focus Issues

Input value isn't saved.

Ensure you trigger blur event or click outside the input after playwright_fill.

Selectors fail

"Element not found" error.

Use playwright_evaluate({ script: "document.body.innerHTML" }) to inspect what the bot actually sees.

7. Checklist for "Done"

Before marking a task complete, verify:

$$$$

 Navigation: playwright_navigate returned successfully (no 404/500).

$$$$

 Action: playwright_click was performed on the primary call-to-action.

$$$$

 Data: playwright_fill was used on all new form inputs.

$$$$

 Proof: playwright_screenshot exists showing the final success state (not just the initial state).

$$$$

 Resilience: The test didn't rely on wait(5000) arbitrary sleeps; it used event-based waiting.