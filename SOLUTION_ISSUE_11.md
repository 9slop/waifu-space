# Solution for Issue #11

## 🛠️ Proposed Solution (by Aditya Waghamare)

### Analysis
The server crashes with a `ReferenceError: window is not defined` when cleaning up event listeners during SSR or server-side component rendering in SolidJS (`CalendarPlanner.tsx:209`). Browser globals like `window` are accessed during server cleanup hooks without checking for execution environment (`typeof window !== 'undefined'`).

### Fix
Guard window access and event listener removal with a check ensuring `window` is defined before calling methods on it, or use SolidJS's `onCleanup` properly within browser-only reactive scopes.

### Implementation
```tsx
// In src/components/CalendarPlanner.tsx
onCleanup(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener("keydown", handleKeyDown);
  }
});
```

### Testing
Verify that server-side rendering and component unmounting on the server/client boundary do not throw `ReferenceError: window is not defined`.

Signed-off-by: Aditya Waghamare <adityawaghamare7620@gmail.com>

---
*Submitted by Aditya Waghamare*
💰 **Payout Address (Base L2 / EVM):** `0xb61dBcdBc3407F71EaCb64D4CBFAcf9FFfe2415C`