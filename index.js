const { Client, collectPaginatedAPI } = require('@notionhq/client');
let Parser = require('rss-parser');
require('dotenv').config();

// Initializing a client and parser
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const parser = new Parser();

function addFeedItemsToDatabase(feed, databaseId) {
  let last_fetched = feed.properties["Last Fetched"].number || 0;
  return parser
    .parseURL(feed.properties.URL.url)
    .then(feed => {
      feed.items
        .filter(item => {
          return (Date.parse(item.pubDate) > last_fetched);
        }).forEach(item => {
        // Test if an item with the same link is in the database
        let current = collectPaginatedAPI(notion.databases.query, {
            database_id: databaseId,
            filter: {
              property: "URL",
              url: item.link
            }
          })[0];
        let properties = {
          Name: {
            title: [{ type: "text", text: { content: item.title } }],
          },
          URL: {
            url: item.link
          },
          'Publication Date': {
            date: {
              start: (new Date(Date.parse(item.pubDate))).toISOString()
            }
          },
          Source: {
            rich_text: [{
              text: {
                content: feed.title
              },
              type: 'text'
            }]
          }
        }
        let cover = undefined;
        if (item.enclosure) {
          cover = {
            type: 'external',
            external: {
              url: item.enclosure.url
            }
          }
        }
        if (current) {
            notion.pages.update({
              parent: { database_id: databaseId },
              page_id: current.id,
              properties: properties,
              cover: cover
            })
        } else {
          notion.pages.create({
            parent: { database_id: databaseId },
            properties: properties,
            cover: cover
          });
        }
      })
      return '';
    },
    err => {
        return err.message;
    })
}

function fetchAllFromConfig(configDatabaseId, targetDatabaseId) {
  let now = Date.now();
  return collectPaginatedAPI(notion.databases.query, {
    database_id: configDatabaseId,
  }).then(items => {
      for (let item of items) {
        console.log("Fetching", item.properties.Name.title[0].text.content, "with url", item.properties.URL.url);
        addFeedItemsToDatabase(item, targetDatabaseId).then(err => {
          notion.pages.update({
            page_id: item.id,
            properties: {
              'Last Fetched': {
                number: now
              },
              'Last Error': {
                rich_text: [{
                  text: {
                    content: err
                  }
                }]
              }
            }
          });
        })
      }
    });
}

fetchAllFromConfig(process.env.NOTION_CONFIG_DATABASE_ID, process.env.NOTION_DATABASE_ID);
