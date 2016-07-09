
// example bot
import botkit from 'botkit';
import Yelp from 'yelp';

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

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'I AM AWAKE http://giphy.com/gifs/game-of-thrones-jon-snow-awake-3o7qE2fiT5seO2lIre');
});

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

// adapted from pizzabot example
controller.hears(['hungry', 'food', 'eat'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  const askWhere = (response, convo) => {

  };


  const askType = (response, convo) => {
    convo.ask('What type of food are you interested in?', (resp, conv) => {
      convo.say('Ok!');
      // askWhere(response, convo, response.text);
      convo.next();
    });
  };
  const askFood = (response, convo) => {
    convo.ask('Would you like food recommendations near you?', [
      {
        pattern: bot.utterances.yes,
        callback: (resp, conv) => {
          convo.say('Awesome!');
          askType(resp, conv);
          convo.next();
        },
      },
      {
        pattern: bot.utterances.no,
        callback: (resp, conv) => {
          convo.say('Ugh then why did you ask me?');
          convo.next();
        },
      },
      {
        default: true,
        callback: (resp, conv) => {
          convo.say('Wtf you talking about?');
          convo.repeat();
          convo.next();
        },
      },
    ]);
  };
  bot.startConversation(message, askFood);
});
