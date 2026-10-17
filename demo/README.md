# Demo UI

`pentrack.html` is a self-contained, clickable mock of the ticketing UI built
over the same mock dataset the MCP server uses. It's for showing the company
"here's what we're working with" — it is **not** wired to the MCP server.

Open it directly in a browser:

```bash
open demo/pentrack.html      # macOS
```

What it does (all client-side, changes saved in your browser only):

- Click a ticket in the left rail to open it.
- See the attached screenshot inline.
- Change status from the dropdown.
- Add a comment (Cmd/Ctrl+Enter to post).
- Light/dark toggle.

The three actions here mirror the MCP tools: `get_ticket`, `add_comment`,
`update_ticket_status`.
