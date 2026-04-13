# shorty

A lightweight URL shortener API built to practice web servers and databases end to end. Built with Express, PostgreSQL, and Redis, deployed on Vercel.

## Stack

- **Runtime**: Node.js + Express 5
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis
- **Deploy**: Vercel

## How it works

Short codes are generated with [nanoid](https://github.com/ai/nanoid). On redirect, shorty checks Redis first. If there's a cache miss, it queries Postgres and only caches the URL after the link has been visited at least twice — avoiding cache pollution from one-off clicks. Click counts are tracked on every visit.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/links` | Create a short link |
| `GET` | `/:code` | Redirect to the original URL |
| `GET` | `/links` | List all links |
| `GET` | `/cache` | View all cached entries in Redis |
| `DELETE` | `/links/:id` | Delete a link by ID |
| `DELETE` | `/clear` | Clear all links and cache |

### POST /links

```json
// Request
{ "original_url": "https://example.com/some/long/path" }

// Response 201
{ "id": 1, "original_url": "https://example.com/some/long/path", "short_code": "aB3xYz", "click_count": 0, "created_at": "..." }
```

## Setup

### Environment variables

Create a `.env` file:

```
DATABASE_URL=your_postgres_connection_string
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### Database

Run this in Neon to create the links table:

```sql
CREATE TABLE links (
  id SERIAL PRIMARY KEY,
  original_url TEXT NOT NULL,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Run locally

```bash
npm install
node index.js
```

Server starts on `http://localhost:3000`.

## Deploy

This project is configured for Vercel. Push to your linked repo or run:

```bash
vercel deploy
```
