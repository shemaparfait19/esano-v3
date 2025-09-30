Implementation Plan: Connection Features

Status summary

- Done:
  - Requests are saved in Firestore and visible to recipients (pending state).
  - Notifications are created on request send (collection `notifications`).
  - Notifications count shown via bell icon in dashboard header and link to Notifications page.
  - SuggestionCard: Request button -> toast + inline "Requested" state; status badges (Connected/Pending); inline Accept/Decline when viewer has an incoming request for that suggestion.
  - Read-only other-user profile page with Accept/Decline actions for incoming requests.
- Not yet (next up in this plan):
  - Dropdown notification list with pending requests + inline actions.
  - Real-time updates for notifications (snapshot listeners).
  - Chat system scaffold (APIs + minimal UI), gated by accepted connections.

1. Fix connection request visibility (User B must see User A's request)

- Backend
  - Confirmed write path: `connectionRequests` created with `status='pending'`.
  - Added notification write: `notifications` doc for recipient (type `incoming_connection_request`).
- Frontend
  - Notifications page lists incoming/outgoing pending via queries on `connectionRequests`.
  - Header bell shows pending incoming count.

2. Notification icon/system

- Implemented bell icon in `DashboardHeader` with unread count.
- Added dropdown stub linking to Notifications page (ready to populate with list in next step).
- Next: add snapshot listener + map of pending items with Accept/Decline.

3. Inline Accept/Decline in suggestions list

- Implemented in `SuggestionCard`:
  - Detect incoming pending request from suggested user -> show Accept/Decline.
  - Accept/Decline calls `/api/requests` PATCH and updates local state.

4. Connection status on SuggestionCard

- Implemented badges:
  - Connected badge for accepted request in either direction.
  - Pending badge for outgoing or incoming pending state.

5. Chat system (planned next)

- Backend endpoints to add:
  - `POST /api/chat/send` (validate accepted connection; write to `messages`).
  - `GET /api/chat/messages?peerId=` (fetch conversation).
  - `GET /api/chat/list` (last message per peer, only connected pairs).
- Data model (Firestore):
  - `messages` with fields: senderId, receiverId, text, createdAt, isRead.
  - Index: composite on (senderId, receiverId, createdAt).
- Frontend:
  - Chat component (thread view + input) gated when connection is accepted.
  - Polling first; upgrade to snapshot listeners.

Follow-ups and considerations

- Security: server-side enforcement for accepting/declining via `/api/requests` already exists; ensure client writes fallback remain aligned with rules.
- Performance: add limits and indexes on queries used for notifications/suggestions.
- UX: surface success/error toasts consistently; disable duplicate actions during transitions.
