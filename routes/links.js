const express = require('express')
const router = express.Router()
const pool = require('../db')
const { nanoid } = require('nanoid')
const redis = require('../redis')

/*
    === creates the shorten url ===
    when a post request is recieved from the router, this runs.
    1. checks if theres a og url
    2. uses nanoid to create a shortened url
    3. inserts (og url, shorty url) in to dbs with a query
    4. hopes for a 201(means created)  
    ** if ^ fails, then 500(server error) is returned.
*/
router.post('/links', async (req, res) => {
  const { original_url } = req.body

  if (!original_url) {
    return res.status(400).json({ error: 'original_url is required' })
  }

  try {
    const short_code = nanoid(6)

    const result = await pool.query(
      'INSERT INTO links (original_url, short_code) VALUES ($1, $2) RETURNING *',
      [original_url, short_code]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'POST new shorty/og url failed...' })
  }
})

/* 
    === get all links ===
    runs the select query to get all links and returns them to the response.
    pretty straight forward ngl
*/
router.get('/links', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM links ORDER BY created_at DESC'
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'GET links failed...' })
  }
})

/* 
    === delete a link ===
    when the delete request is recieved this happens
    1. delete query runs
    2. the rows that were deleted should return
    3. rows == 0 means its missing...
    4. otherwise it sends a message backs saying the link is deleted
*/
router.delete('/links/:id', async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query(
      'DELETE FROM links WHERE id = $1 RETURNING *',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    res.json({ message: 'Link deleted', link: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'DELETE link failed...' })
  }
})

/*
  === gets cached linked from redis ===
  when a get request for the cache is received this happens.
  1. get all keys in the cache
  2. checks if theres no keys, then its empty, return nothing
  3. if its not empty then use the key to get the og link and return it
*/ 
router.get('/cache', async (req, res) => {
  try {
    const keys = (await redis.keys('*')).filter(key => !key.startsWith('visits:'))
    
    if (keys.length === 0) {
      return res.json([])
    }

    const values = await Promise.all(
      keys.map(async (key) => ({
        short_code: key,
        original_url: await redis.get(key),
        ttl: await redis.ttl(key)
      }))
    )

    res.json(values)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

/*
    === redirects to og url ===
    when a get request is revieved from the router, this happens.
    1. checks cache first
    2. else runs a query to get the row that matches the short code
    3. if result is empty... then it was never in the db lol
    4. otherwise we have the link!
    5. update the click count for that row
    6. return a redirect with the og url
 */
router.get('/:code', async (req, res) => {
  const { code } = req.params

  try {
    // Check Redis cache first
    const cached = await redis.get(code)

    if (cached) {
      console.log('cache hit')
      await pool.query(
        'UPDATE links SET click_count = click_count + 1 WHERE short_code = $1',
        [code]
      )
      return res.redirect(cached)
    }

    // Not in cache, query Postgres
    console.log('cache miss')
    const result = await pool.query(
      'SELECT * FROM links WHERE short_code = $1',
      [code]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    const link = result.rows[0]

    // Increment visit counter in Redis
    const visitKey = `visits:${code}`
    const visits = await redis.incr(visitKey)

    // Only cache after 2 visits
    if (visits >= 2) {
      console.log('caching after 2 visits')
      await redis.set(code, link.original_url, { ex: 86400 })
    }

    await pool.query(
      'UPDATE links SET click_count = click_count + 1 WHERE id = $1',
      [link.id]
    )

    res.redirect(link.original_url)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

/*
  === clear the postgres db ==
  i want the db to empty every day at 12AM so that it doesn't messy
  delete everything lol
*/
router.delete('/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM links')
    res.json({ message: 'Database cleared' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

module.exports = router