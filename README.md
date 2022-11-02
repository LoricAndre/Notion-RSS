# Notion RSS Feed Integration

## Objective
As I am not fond of most RSS readers, I have been meaning to integrate one into other services. Here is my attempt at notion.
The goal here is to send RSS feeds to a unique database, then do the sorting and filtering from notion.

## Setup
### Notion
The feeds' configuration is done from a database, requiring the following fields:
- `Name`,
- `URL` (`link`)
- `Last Fetched` (`number`)
- `Last Error` (`text`)
This allows us to interact only with notion itself once the setup is done.

The target database requires the following fields:
- `Name`
- `Created Time` (for sorting and filtering)
- `URL`, a `link` field
- `Source`, a `text` field

### Server
Simply clone this repository, rename `.env.example` to `.env` and set the correct variables, then run
```bash
npm i
node index.js
```
This requires node and npm to be installed.
To run this periodically, the easiest way is to setup a crontab, setting the following entry (for a 2min delay)
```cron
*/2 * * * * cd /home/<user>/Notion-RSS && /usr/bin/node index.js
```

## Usage
You simply need to add feeds to the configuration database, setting a name and URL.
Then, when the script runs, it will fetch all new items and add them to the database.
