# Real-Time Collaborative Taskboard

A real-time collaborative task management API built with **Node.js, Express.js, PostgreSQL, JWT Authentication, and Socket.IO**.

The application allows users to collaborate within workspaces, organize tasks using boards and columns, manage task assignments, and receive real-time updates when other members make changes.

## Features

- **User Authentication:** Secure signup and login using JWT authentication and password hashing.
- **Workspaces:** Create and manage collaborative workspaces.
- **Role-Based Access Control:** Different permissions for workspace admins and members.
- **Boards:** Organize work using boards and columns.
- **Task Management:** Create, update, move, and delete tasks.
- **Task Comments:** Add and retrieve comments on tasks.
- **Real-Time Updates:** Socket.IO broadcasts task creation, updates, movements, deletions, and comments.
- **Online Presence:** Track users currently connected to a board.
- **Access Control:** Restrict board and task access based on workspace membership.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | REST API framework |
| PostgreSQL | Relational database |
| Socket.IO | Real-time communication |
| JWT | Authentication |
| bcrypt | Password hashing |
| Postman | API testing |
| Git & GitHub | Version control |

## API Endpoints

All protected endpoints require a valid JWT Bearer token.

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a user |
| POST | `/api/auth/login` | Log in a user |

### Workspaces and Boards
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/workspaces` | Create a workspace |
| POST | `/api/workspaces/:id/boards` | Create a board |
| GET | `/api/boards/:id` | Retrieve board details |
| POST | `/api/workspaces/:id/members` | Add a workspace member |

### Tasks and Comments
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| PATCH | `/api/tasks/:id/move` | Move a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/:id/comments` | Add a comment |
| GET | `/api/tasks/:id/comments` | Retrieve task comments |

## Real-Time Events

Socket.IO provides real-time communication between users connected to the same board.

| Event | Description |
|---|---|
| `task:created` | A new task is created |
| `task:updated` | An existing task is updated |
| `task:moved` | A task is moved to another column |
| `task:deleted` | A task is deleted |
| `comment:added` | A new comment is added |
| `presence` | Board users' online status is updated |

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/JELINA-J/Real-Time-Collaborative-Taskboard.git
cd Real-Time-Collaborative-Taskboard
```

### 2. Install dependencies

```bash
npm install
```

Run this in the directory containing the server's `package.json`.

### 3. Configure environment variables

Create a `.env` file in the server directory:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskboard
JWT_SECRET=your_secure_random_secret
PORT=4000
```

Replace the database credentials and JWT secret with your own values.

### 4. Set up PostgreSQL

Create a PostgreSQL database named `taskboard` and configure the required database tables using the project's database schema.

### 5. Start the server

Use the development or start command configured in your `package.json`.

The API runs at:

```text
http://localhost:4000
```

## API Testing

You can test the REST API using Postman.

1. Register and log in to obtain a JWT token.
2. Set the token under **Authorization → Bearer Token**.
3. Create a workspace and board.
4. Add workspace members.
5. Create, update, move, and comment on tasks.
6. Connect multiple users using Socket.IO to test real-time events.

## Security

- Passwords are hashed before storage.
- Protected API routes require JWT authentication.
- Workspace membership and user roles are checked before accessing protected resources.
- Keep `.env` and all secret credentials out of version control.

## Author

**Jelina J**

GitHub: [JELINA-J](https://github.com/JELINA-J)

---

*This project was developed to explore backend development, REST API design, authentication, database management, access control, and real-time collaboration.*
