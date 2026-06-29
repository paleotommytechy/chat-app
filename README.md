# Real-Time Chat Application

A production-grade real-time chat application built with Node.js, Express, Socket.IO, MongoDB, React, and Tailwind CSS.

## Architecture

```
chat-app/
├── server/          # Node.js backend
│   ├── src/
│   │   ├── config/      # Environment and DB config
│   │   ├── models/      # MongoDB schemas (User, Room, Message)
│   │   ├── middleware/  # Auth and access middleware
│   │   ├── routes/      # REST API endpoints
│   │   ├── sockets/     # Socket.IO connection and event handlers
│   │   ├── services/    # Typing indicator service
│   │   └── utils/       # Constants
│   ├── index.js         # Server entry point
│   └── .env
└── client/           # React frontend
    ├── src/
    │   ├── hooks/       # Custom hooks
    │   ├── context/     # React Context providers
    │   ├── components/  # UI components
    │   ├── pages/       # Page components
    │   └── services/    # Socket and API utilities
    ├── index.html
    ├── vite.config.js
    └── tailwind.config.js
```

## Socket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `connection` | client → server | `{ token }` | JWT handshake |
| `join_room` | client → server | `{ roomId }` | Request room entry |
| `leave_room` | client → server | `{ roomId }` | Exit room |
| `new_message` | client → server | `{ roomId, text }` | Send message |
| `typing_start` | client → server | `{ roomId }` | Start typing |
| `typing_stop` | client → server | `{ roomId }` | Stop typing |
| `new_message` | server → client | `{ roomId, message }` | Incoming message |
| `typing_list` | server → client | `{ roomId, users }` | Who's typing |
| `online_list` | server → client | `{ roomId, users }` | Who's present |
| `room_error` | server → client | `{ message }` | Access denied, etc. |

## Room Access Model

- **Public rooms**: Any authenticated user can join
- **Private rooms**: Only users in the `members` array can join; creator manages members

## Environment Variables

### Server (.env)
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your-secret-key-change-in-production
CLIENT_URL=http://localhost:5173
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally or connection string

### Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Development

```bash
# Start MongoDB
mongod

# Start server (from server directory)
npm run dev

# Start client (from client directory)
npm run dev
```

### Production

```bash
# Build client
cd client
npm run build

# Start server
cd ../server
npm start
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Rooms
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms/:id/members` - Add member to private room
- `DELETE /api/rooms/:id/members/:userId` - Remove member from private room

### Messages
- `GET /api/messages/room/:roomId` - Get message history (paginated)