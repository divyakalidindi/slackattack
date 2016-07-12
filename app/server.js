// example bot
import botkit from 'botkit';
import Yelp from 'yelp';
import dotenv from 'dotenv';

const request = require('request');

// environment variables
dotenv.config();

// for yelp searching
const yelpbot = new Yelp({
  consumer_key: process.env.YELP_CONSUMER_KEY,
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: process.env.YELP_TOKEN,
  token_secret: process.env.YELP_TOKEN_SECRET,
});

console.log('starting bot');

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM(err => {
  // start the real time message client
  if (err) { throw new Error(err); }
});

// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

// Syntax for word matching found at https://github.com/howdyai/botkit/issues/43
controller.hears(['^hello', '^hi', '^howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// To send a gif when slackbot is awakened by name
controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'I AM AWAKE http://giphy.com/gifs/game-of-thrones-jon-snow-awake-3o7qE2fiT5seO2lIre');
});


// heavily adapted from pizzabot example on Botkit Github Page
controller.hears(['hungry', 'food'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  let foodType = '';
  const getYelpResults = (response, convo) => {
    yelpbot.search({ term: `${foodType}`, location: response.text, limit: 3 })
    .then((data) => {
      if (Object.keys(data.businesses).length === 0) {
        // no food of that type
        convo.say('No matches found!');
        convo.next();
      } else {
        data.businesses.forEach(business => {
          const replyWithAttachments = {
            text: `rating: ${business.rating}`,
            attachments: [
              {
                fallback: 'No matches found!',
                title: `${business.name}`,
                text: `${business.snippet_text}\n\n ${business.mobile_url}`,
                image_url: `${business.image_url}`,
                color: '#7CD197',
              },
            ],
          };
          bot.reply(message, replyWithAttachments);
          convo.next();
        });
      }
    })
    .catch((error) => {
      // because of an invalid location
      convo.say('The location you inputed is probably invalid. I\'m having trouble processing your query');
      convo.repeat();
    });
  };

  const askWhere = (response, convo) => {
    convo.ask('Where are you right now?', (response, convo) => {
      convo.say('Ok! One sec. Pulling up results...');
      convo.next();
      getYelpResults(response, convo);
      convo.next();
    });
  };
  const askType = (response, convo) => {
    convo.ask('What type of food are you interested in?', (response, convo) => {
      foodType = response.text;
      convo.say('Ok!');
      askWhere(response, convo);
      convo.next();
    });
  };
  const askHungry = (response, convo) => {
    convo.ask('Would you like food recommendations near you?', [
      {
        pattern: bot.utterances.yes,
        callback: (response, convo) => {
          convo.say('Great!');
          askType(response, convo);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback: (response, convo) => {
          convo.say('So then why did you ask?');
          convo.next();
        },
      },
      {
        default: true,
        callback: (response, convo) => {
          convo.say('I\'m not sure what you mean.');
          convo.repeat();
          convo.next();
        },
      },
    ]);
  };
  bot.startConversation(message, askHungry);
});

// general help response
controller.hears('help', ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'Don\'t worry! Try typing the word \'food\' or \'hungry\' to get some food recommendations, or \'weather\' to check the forecast in any city in the world!');
});

// adapted from http://www.solstice-mobile.com/blog/the-beginners-guide-to-building-an-intelligent-bot-on-slack
// and https://gist.github.com/cmaneu/932e4628712ec9bbcaea
// https:// github.com/cmfcmf/OpenWeatherMap-PHP-Api/issues/46
// API key from openweathermap.org
controller.hears('weather', ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  let weatherRequest = '';

  const getWeatherResults = (res, c) => {
    request(`http://api.openweathermap.org/data/2.5/weather?q= + ${weatherRequest} + &mode=json&units=imperial&APPID=9f221424f8c02da26210bee0d4ad1cdb`, (error, response, body) => {
      const weatherForecasts = JSON.parse(body);
      c.say(`The weather in ${weatherForecasts.name}, ${weatherForecasts.sys.country} is: ${weatherForecasts.main.temp} °F. \n Today's forecast calls for ${weatherForecasts.weather[0].description}, with a high of ${weatherForecasts.main.temp_max} °F and a low of ${weatherForecasts.main.temp_min} °F `);
      c.next();
    });
  };

  const askWeather = (res, c) => {
    c.ask('What place are you thinking of?', (res, c) => {
      weatherRequest = res.text;
      c.say('Ok! Give me a second!');
      c.next();
      getWeatherResults(res, c);
      c.next();
    });
  };
  bot.startConversation(message, askWeather);
});

// for a random messsage that doesn't match a keyword already specified above
controller.hears('(.*)', ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.reply(message, 'I don\'t understand. Maybe try again? (Hint: Type \'help\'!)');
});
