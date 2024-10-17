const figlet = require('figlet');
const {
  getAddedMicroservices,
  getRemovedMicroservices,
  getEnabledMicroservices,
  updateEnabledMicroservices,
} = require('./utilities/microservices.util');
const {
  addRepositories,
  removeRepositories,
} = require('./assemble/assemble-repositories');
const {checkMode} = require('./check/check-mode');
const {checkbox, select} = require('@inquirer/prompts');
const {bold, cyan, green, inverse} = require('colorette');
const {handleLoading} = require('./utilities/loading.util');
const {assembleEnvFile} = require('./assemble/assemble-env');
const {assembleSchemaFiles} = require('./assemble/assemble-schema');
const {assembleNestJsAssets} = require('./assemble/assemble-assets');
const {assembleNestJsModules} = require('./assemble/assemble-modules');
const {assembleDependencies} = require('./assemble/assemble-dependencies');
const {ALL_MICROSERVICES} = require('./constants/microservices.constants');

const main = async () => {
  // [step 1] Print the logo of the command-line tool.
  console.info(
    figlet.textSync('Newbie', {
      font: 'Epic',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true,
    })
  );

  // [step 2] Check the mode.
  const modeCheck = await checkMode();
  if (!modeCheck) {
    process.exit(0);
  }

  // [step 3] Print the usage of the command-line tool.
  console.info('What is newbie?');
  console.info(' -----------------------------------------------------------');
  console.info('| Newbie is a backend development framework based on NestJS.|');
  console.info('| The main goal of the framework is to allow developers to  |');
  console.info('| reuse ready-made modules such as account, workflow, etc.  |');
  console.info('| We can flexibly add or remove these ready-made modules in |');
  console.info('| the project.                                              |');
  console.info(
    ' -----------------------------------------------------------\n'
  );

  console.info('How to use newbie?');
  console.info(' -----------------------------------------------------------');
  console.info('|* Press <Up> and <Down> to move the cursor.                |');
  console.info('|* Press <Space> to toggle between enabled and disabled.    |');
  console.info('|* Press <Enter> to finish the configuration.               |');
  console.info('|* Press <Q> to quit without saving the configuration.      |');
  console.info(
    ' -----------------------------------------------------------\n'
  );

  // [step 4] Main function.
  const allMicroservices = Object.keys(ALL_MICROSERVICES);
  const currentMicroervices = await getEnabledMicroservices();

  // [step 4-1] Enable and disable services.
  const enabledMicroservices = await checkbox({
    message: 'Which microservices do you want to enable for your project:',
    choices: allMicroservices.map(microservice => {
      const checked = currentMicroervices.includes(microservice);
      return {
        value: microservice,
        name: `${microservice}${checked ? '(enabled)' : ''}`,
        checked,
      };
    }),
    pageSize: 100,
    loop: true,
    theme: {helpMode: 'never'},
  });
  const addedMicroservices = await getAddedMicroservices(enabledMicroservices);
  const removedMicroservices =
    await getRemovedMicroservices(enabledMicroservices);

  // [step 4-2] Confirm the operation.
  let message = '';
  if (!addedMicroservices.length && !removedMicroservices.length) {
    console.info(
      '\n[info] You did not make any changes to the microservices.\n'
    );
    process.exit(0);
  } else if (!removedMicroservices.length && addedMicroservices.length) {
    message = `Are you sure you want to ENABLE ${cyan(
      addedMicroservices.join(', ')
    )} ?`;
  } else if (removedMicroservices.length && !addedMicroservices.length) {
    message = `Are you sure you want to DISABLE ${inverse(
      removedMicroservices.join(', ')
    )} ?`;
  } else {
    message = `Are you sure you want to DISABLE ${inverse(
      removedMicroservices.join(', ')
    )} and ENABLE ${cyan(addedMicroservices.join(', '))} ?`;
  }

  const result = await select({
    message: `\n${message}`,
    choices: [
      {name: 'Yes', value: 'yes'},
      {name: 'No', value: 'no'},
    ],
    theme: {prefix: '', helpMode: 'never'},
  });

  // [step 4-3] Execute the operation.
  if (result === 'yes') {
    // Update enable.json first.
    await updateEnabledMicroservices(enabledMicroservices);

    // Assemable project files.
    if (addedMicroservices.length > 0) {
      await handleLoading('🥥 Clone code repositories ', async () => {
        await addRepositories(addedMicroservices);
      });
    }

    await handleLoading('🍎 Update environment variables', async () => {
      await assembleEnvFile(addedMicroservices, removedMicroservices);
    });

    await handleLoading('🫐 Update database schema', async () => {
      await assembleSchemaFiles(addedMicroservices, removedMicroservices);
    });

    await handleLoading('🍌 Update nestjs assets', async () => {
      await assembleNestJsAssets(addedMicroservices, removedMicroservices);
    });

    await handleLoading('🍉 Update nestjs modules', async () => {
      await assembleNestJsModules();
    });

    await handleLoading('🥝 Update package dependencies', async () => {
      await assembleDependencies(addedMicroservices, removedMicroservices);
    });

    if (removedMicroservices.length > 0) {
      await handleLoading('🍒 Delete code repositories', async () => {
        await removeRepositories(removedMicroservices);
      });
    }
    console.info(bold(green('🍺 C O M P L E T E\n')));
  } else {
    console.info(
      '\n[info] You did not make any changes to the microservices.\n'
    );
  }
};

main();

// Close inquirer input if user press "Q" or "Ctrl-C" key
process.stdin.on('keypress', (_, key) => {
  if (key.name === 'q' || (key.ctrl === true && key.name === 'c')) {
    console.info(
      '\n\n[info] You did not make any changes to the microservices.'
    );
    process.exit(0);
  }
});
