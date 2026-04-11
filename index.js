const express = require('express')
require('dotenv').config()

const app = express()
app.use(express.json())

const linksRouter = require('./routes/links')
app.use('/', linksRouter)

process.on('uncaughtException', (err) => {
  console.error('Uncaught error:', err)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))