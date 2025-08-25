const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

const LogFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    LogFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/app-error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/app-combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

Logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/exceptions.log' })
);

async function UpdateMemberCount() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ]
  });

  client.once('ready', () => {
    Logger.info(`Logged in as ${client.user.tag}`);
  });

  client.on('debug', (info) => {
    Logger.debug(info);
  });

  client.on('warn', (info) => {
    Logger.warn(info);
  });

  client.on('error', (error) => {
    Logger.error('Client error:', error);
  });

  try {
    Logger.info('Attempting to login...');
    await client.login(process.env.APP);
    
    Logger.info('Fetching guild and channel...');
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channel = await guild.channels.fetch(process.env.CHANNEL_ID);
    
    if (!channel) {
      throw new Error(`Channel with ID ${process.env.CHANNEL_ID} not found`);
    }
    
    if (!channel.isTextBased()) {
      throw new Error(`Channel with ID ${process.env.CHANNEL_ID} is not a text channel`);
    }
    
    const formattedCount = guild.memberCount.toLocaleString();
    const newChannelName = `Total Members: ${formattedCount}`;
    
    if (channel.name !== newChannelName) {
      Logger.info(`Updating channel name to: ${newChannelName}`);
      await channel.setName(newChannelName);
      Logger.info('Successfully updated member count channel name');
    } else {
      Logger.info('Member count unchanged, skipping channel name update');
    }
    
    const activityMessage = `${formattedCount} Members`;
    Logger.info(`Updating app presence to: Watching ${activityMessage}`);
    
    client.user.setPresence({
      activities: [{
        name: activityMessage,
        type: ActivityType.Watching
      }],
      status: 'dnd',
    });

    Logger.info(`Presence updated successfully`);
    
    const waitTime = process.env.WAIT_TIME || 150000;
    Logger.info(`Waiting ${waitTime/1000} seconds before disconnecting...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
  } catch (error) {
    Logger.error('Error in UpdateMemberCount:', error);
    throw error;
  } finally {
    Logger.info('Disconnecting client...');
    client.destroy();
    Logger.info('Client disconnected successfully');
  }
}

if (require.main === module) {
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  UpdateMemberCount()
    .then(() => {
      Logger.info('Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      Logger.error('Update failed:', error);
      process.exit(1);
    });
}

module.exports = { UpdateMemberCount, Logger };