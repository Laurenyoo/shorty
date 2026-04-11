const express = require('express')
const router = express.Router()
const pool = require('../db')
const { nanoid } = require('nanoid')

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
    === redirects to og url ===
    when a get request is revieved from the router, this happens.
    1. runs a query to get the row that matches the short code
    2. if result is empty... then it was never in the db lol
    3. otherwise we have the link!
    4. update the click count for that row
    5. return a redirect with the og url
 */
router.get('/:code', async (req, res) => {
  const { code } = req.params

  try {
    const result = await pool.query(
      'SELECT * FROM links WHERE short_code = $1',
      [code]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' })
    }

    const link = result.rows[0]

    await pool.query(
      'UPDATE links SET click_count = click_count + 1 WHERE id = $1',
      [link.id]
    )

    res.redirect(link.original_url)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'GET redirect failed...' })
  }
})

module.exports = router