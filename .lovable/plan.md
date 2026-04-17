
## VSIX Runner — Chat UI (Mock Backend)

A single-page chat interface that simulates running a VS Code extension locally. No real VSIX execution — everything runs in the browser with a mocked command registry.

### Layout
- **Left sidebar**: "Loaded Extension" panel
  - Drop zone / file picker for `.vsix` upload (file is read but not executed — we just parse the name and pretend to register a few demo commands)
  - List of "registered commands" with status indicator
  - Reset button
- **Main area**: Chat interface
  - Message list (user + bot bubbles, markdown rendering)
  - Input box at the bottom with send button
  - Each user message is routed to the first registered command, which returns a mocked reply

### Behavior
- On load: show an empty state inviting the user to "install" a VSIX
- After upload: 
  - Animate a fake install log ("Extracting…", "Loading package.json…", "Registered command: alphabot.ask")
  - Enable the chat input
- Chat replies use a small canned-response engine (echo, simple pattern matching like "hello" → "hi there", "help" → command list) so it feels alive without any backend
- Persist chat history + loaded extension state in `localStorage` so refreshing keeps the session

### Style
- Dark VS Code-inspired theme (deep gray background, monospace accents for command names, subtle blue accent for the active extension)
- Terminal-style install log with green success lines
- Clean chat bubbles with markdown support

### Out of scope
- No real VSIX extraction or Node module loading (not possible in browser)
- No accounts, no server, no database
