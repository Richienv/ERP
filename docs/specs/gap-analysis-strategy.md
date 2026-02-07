# Handling Missing Functions: Fit-Gap Analysis

**The Scenario**: The Client wants a specific step (e.g., "AI Quality Scan"), but our ERP doesn't have it (Module Key not found).
**The Question**: What do Big ERPs (SAP, Oracle) do?

## 1. Industry Standard: "Fit-Gap Analysis"
They don't reject the requirement. They classify it.
*   **Fit**: The feature exists (Standard).
*   **Gap**: The feature is missing (Requires Customization).

In the enterprise world, this generates a **RICEFW Object**:
*   **R**eports
*   **I**nterfaces
*   **C**onversions
*   **E**nhancements
*   **F**orms
*   **W**orkflows

## 2. Our Strategy: "Visual Gap Detection"
Instead of throwing an error ("Invalid Module Reference"), our system should:
1.  **Accept the Input**: Recognize that the business *needs* this step.
2.  **Flag as GAP**: Mark it as a "Custom Requirement".
3.  **Visualize the Void**: Render the node in the diagram, but style it differently (e.g., **Red/Dashed Border**).
4.  **Action Item**: List these "Gaps" as a To-Do list for the developer.

## 3. Implementation Plan
We will modify the Engine to support "Ghost Nodes":

1.  **Validator**: Allow unknown `Mapped_Module_Key`s but mark them as `type: "GAP"`.
2.  **Visualizer**:
    *   **Standard Node**: Blue/Orange (Existing).
    *   **Gap Node**: Red, Dashed Line. Label: "⚠️ Custom Dev: [Action Name]".
3.  **Sidebar**:
    *   Standard modules are enabled.
    *   Gaps are listed in a "Customization Request" report.

**Result**: The blueprint remains the "Single Source of Truth", accurately showing both what we *have* and what we *need to build*.
