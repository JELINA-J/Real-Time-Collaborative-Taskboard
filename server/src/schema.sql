CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL DEFAULT 'member',  -- 'admin' or 'member'
  UNIQUE (user_id, workspace_id)
);

CREATE TABLE boards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  workspace_id INT REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE columns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position INT NOT NULL,
  board_id INT REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  position INT NOT NULL,
  column_id INT REFERENCES columns(id) ON DELETE CASCADE,
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);