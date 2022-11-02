const { Client, collectPaginatedAPI } = require('@notionhq/client');
const { get } = require('axios');
const { parseString } = require('xml2js');
let Parser = require('rss-parser');

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const parser = new Parser();

function getPropertiesFromItem(item) {
  const {
    title,
    description,
    link,
    pubDate
  } = item;

  return {
    Name: {
      title: [{ type: "text", text: { content: title[0] } }],
    },
    Description: {
      rich_text: [{
        text: {
          content: description[0],
        },
        type: 'text'
      }]
    },
    URL: {
      url: link[0]
    },
  };
}

function getCoverFromItem(item) {
  if (item['media:content']) {
    return {
      type: 'external',
      external: {
        url: item['media:content'][0]['$'].url
      }
    }
  }
}

function fetchFeed(feed, databaseId) {
  let last_fetched = feed.properties["Last Fetched"].number || 0;
  return get(feed.properties.URL.url)
    .then(res => {
      parseString(res.data, (err, res) => {
        if (err) return;
        console.log(res);
        let channel = res.rss.channel[0] || res.rss['$'].channel[0];
        for (let item of channel.item) {
          let properties = getPropertiesFromItem(item);
          properties.Source = {
          rich_text: [{
            text: {
              content: feed.properties.Name.title[0].text.content
            },
            type: 'text'
          }]
          }
          notion.pages.create({
            parent: { database_id: databaseId },
            properties: properties,
            cover: getCoverFromItem(item)
          });
        }
      })
    });
}

function addFeedItemsToDatabase(feed, databaseId) {
  let last_fetched = feed.properties["Last Fetched"].number || 0;
  parser
    .parseURL(feed.properties.URL.url)
    .then(feed => {
      feed.items
        .filter(item => {
          return (Date.parse(item.pubDate) > last_fetched);
        }).forEach(item => {
        let properties = {
          Name: {
            title: [{ type: "text", text: { content: item.title } }],
          },
          URL: {
            url: item.link
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
        notion.pages.create({
          parent: { database_id: databaseId },
          properties: properties,
          cover: cover
        });
      })
    },
    err => {
      console.log("Error fetching", feed.properties.Name.title[0].text.content, ":", err);
    })
}

function fetchAllFromConfig(configDatabaseId, targetDatabaseId) {
  let now = Date.now();
  return collectPaginatedAPI(notion.databases.query, {
    database_id: configDatabaseId,
  }).then(items => {
      for (let item of items) {
        console.log("Fetching", item.properties.Name.title[0].text.content, "with url", item.properties.URL.url);
        addFeedItemsToDatabase(item, targetDatabaseId);
        notion.pages.update({
          page_id: item.id,
          properties: {
            'Last Fetched': {
              number: now
            }
          }
        });
      }
    });
}

function deleteDuplicates(databaseId) {
  return collectPaginatedAPI(notion.databases.query, {
    database_id: databaseId
  }).then(items => {
      for (let item of items.filter(a => {items.find(b => b.properties.Name.title[0].text.content == a.properties.Name.title[0].text.content)})) {
        console.log(item);
      }
    })
}

fetchAllFromConfig(process.env.NOTION_CONFIG_DATABASE_ID, process.env.NOTION_DATABASE_ID);
