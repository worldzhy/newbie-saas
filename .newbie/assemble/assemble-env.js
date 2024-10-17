const fs = require('fs/promises');
const {
  ENV_PATH,
  ENABLED_PATH,
  FRAMEWORK_SETTINGS_JSON,
} = require('../constants/path.constants');
const {exists} = require('../utilities/exists.util');
const {getObjectFromEnvFile} = require('../utilities/env.util');
const {ALL_MICROSERVICES} = require('../constants/microservices.constants');
const {getEnabledMicroservices} = require('../utilities/microservices.util');

/**
 * The assembleEnvFile function does 2 things:
 * 1. Add or remove variables in .env
 * 2. Generate a copy of .env which is named .env.example (for production deployment)
 */

const assembleEnvFile = async (addedMicroservices, removedMicroservices) => {
  const envObj = await getObjectFromEnvFile();
  const isExists = await exists(FRAMEWORK_SETTINGS_JSON);

  // [step 1] Assemble framework environment variables
  if (isExists) {
    const file = await fs.readFile(FRAMEWORK_SETTINGS_JSON, {
      encoding: 'utf8',
      flag: 'r',
    });
    const {env = {}} = JSON.parse(file);
    Object.keys(env).forEach(key => {
      if (!envObj[key]) {
        envObj[key] = env[key];
      }
    });
  } else {
    console.error(`[Error] Missing framework.settings.json!`);
  }

  // [step 2] Assemble microservices environment variables
  // [step 2-1] Add variables to the env object.
  for (let i = 0; i < addedMicroservices.length; i++) {
    const name = addedMicroservices[i];
    const {key, settingsFileName} = ALL_MICROSERVICES[name] || {};

    if (!key) {
      console.error(`[Error] Non-existent microservice<${name}>`);
      continue;
    }

    if (settingsFileName) {
      const settingsFilePath = `${ENABLED_PATH}/${key}/${settingsFileName}`;
      const isExists = await exists(settingsFilePath);

      if (isExists) {
        const file = await fs.readFile(settingsFilePath, {
          encoding: 'utf8',
          flag: 'r',
        });
        const {env = {}} = JSON.parse(file);

        Object.keys(env).forEach(key => {
          if (!envObj[key]) {
            envObj[key] = env[key];
          }
        });
      } else {
        console.error(`[Error] Missing ${name}.settings.json`);
      }
    }
  }

  // [step 2-2] Remove variables from the env object.
  for (let i = 0; i < removedMicroservices.length; i++) {
    const name = removedMicroservices[i];
    const {key, settingsFileName} = ALL_MICROSERVICES[name] || {};

    if (!key) {
      console.error(`[Error] Non-existent microservice<${name}>`);
      continue;
    }
    if (settingsFileName) {
      const settingsFilePath = `${ENABLED_PATH}/${key}/${settingsFileName}`;
      const isExists = await exists(settingsFilePath);

      if (isExists) {
        const file = await fs.readFile(settingsFilePath, {
          encoding: 'utf8',
          flag: 'r',
        });
        const {env = {}} = JSON.parse(file);

        const envKeys = Object.keys(env);
        if (envKeys.length) {
          envKeys.forEach(key => {
            if (envObj[key] !== undefined) {
              delete envObj[key];
            }
          });
        }
      } else {
        console.error(`[Error] Missing ${name}.settings.json`);
      }
    }
  }

  // [step 3] Write the .env file.
  if (Object.keys(envObj).length > 0) {
    await fs.writeFile(
      ENV_PATH,
      Object.entries(envObj)
        .map(e => e.join('='))
        .join('\n')
    );
  } else {
    // Do nothing
  }

  // [step 4] Generate .env.example
  await generateEnvExampleFile();
};

const generateEnvExampleFile = async () => {
  const envExamplePath = './.env.example';
  const enabledMicroservices = await getEnabledMicroservices();
  const frameworkHeaderTemplate = `# -------------------------------------------------------------------------------- #
# This file is generated by newbie command-line tool.                              #
# -------------------------------------------------------------------------------- #

# --------------------------------------------------------------------------------
# ! Framework variables are from ${FRAMEWORK_SETTINGS_JSON}
# --------------------------------------------------------------------------------
# ENVIRONMENT: 'production' or 'development'
# SERVER_SERIAL_NUMBER: Related to cronjob
# --------------------------------------------------------------------------------\n`;

  const getHeaderTemplate = (name, path) => `\n
# ----------------------------------------------------------------------------------
# ! ${name} variables are from ${path}
# ----------------------------------------------------------------------------------\n`;
  const capitalizeFirstLetter = string =>
    string.charAt(0).toUpperCase() + string.slice(1);
  const isExists = await exists(FRAMEWORK_SETTINGS_JSON);

  // [step 1] Append framework variables to .env.example
  await fs.writeFile(envExamplePath, frameworkHeaderTemplate);
  if (isExists) {
    const file = await fs.readFile(FRAMEWORK_SETTINGS_JSON, {
      encoding: 'utf8',
      flag: 'r',
    });
    const {env = {}} = JSON.parse(file);

    if (Object.keys(env).length > 0) {
      await fs.appendFile(
        envExamplePath,
        Object.entries(env)
          .map(e => e.join('='))
          .join('\n')
      );
    }
  }

  // [step 2] Append microservices variables to .env.example
  for (let i = 0; i < enabledMicroservices.length; i++) {
    const name = enabledMicroservices[i];
    const {key, settingsFileName} = ALL_MICROSERVICES[name] || {};

    if (!key) {
      continue;
    }
    if (settingsFileName) {
      const settingsFilePath = `${ENABLED_PATH}/${settingsFileName}`;
      const isExists = await exists(settingsFilePath);

      if (isExists) {
        const file = await fs.readFile(settingsFilePath, {
          encoding: 'utf8',
          flag: 'r',
        });
        const {env = {}} = JSON.parse(file);

        if (Object.keys(env).length > 0) {
          await fs.appendFile(
            envExamplePath,
            getHeaderTemplate(capitalizeFirstLetter(key), settingsFilePath)
          );
          await fs.appendFile(
            envExamplePath,
            Object.entries(env)
              .map(e => e.join('='))
              .join('\n')
          );
        }
      }
    }
  }
};

module.exports = {
  assembleEnvFile,
};