/*!
 * Copyright (c) 2015-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and limitations under the License.
 */


/* eslint-disable no-console, complexity */
const env = require('@okta/env');
const spawn = require('cross-spawn-with-kill');
const waitOn = require('wait-on');
const { config, configPredicate } = require('./config');

env.setEnvironmentVarsFromTestEnv();

const getTask = (config) => () => {
  return new Promise(resolve => {
    // add authClient config to process.env
    if (config.authClient) {
      console.log(`Setting a new value for environment variable "AUTH_CLIENT_CONFIG" from E2E config`);
      process.env.AUTH_CLIENT_CONFIG = JSON.stringify(config.authClient);
    }

    // start the dev server
    const server = spawn('yarn', [
      'workspace',
      config.app,
      'start'
    ], { stdio: 'inherit' });

    waitOn({
      resources: [
        'http-get://localhost:8080'
      ]
    }).then(() => {
      // 2. run webdriver based on if sauce is needed or not
      let wdioConfig = 'wdio.conf.js';
      if (process.env.RUN_SAUCE_TESTS) {
        wdioConfig = 'sauce.wdio.conf.js';
      }

      let opts = process.argv.slice(2); // pass extra arguments through
      const runnerArgs = ['wdio', 'run', wdioConfig];
      (config.spec || []).forEach(spec => {
        runnerArgs.push('--spec');
        runnerArgs.push(`./specs/${spec}`);
      });
      (config.exclude || []).forEach(spec => {
        runnerArgs.push('--exclude');
        runnerArgs.push(`./specs/${spec}`);
      });

      const runner = spawn(
        'yarn', 
        runnerArgs.concat(opts), 
        { stdio: 'inherit' }
      );

      let returnCode = 1;
      runner.on('exit', function (code) {
        console.log('Test runner exited with code: ' + code);
        returnCode = code;
        server.kill();
      });
      runner.on('error', function (err) {
        server.kill();
        throw err;
      });
      server.on('exit', function(code) {
        console.log('Server exited with code: ' + code);
        // eslint-disable-next-line no-process-exit
        process.exit(returnCode);
      });
      process.on('exit', function() {
        console.log('Process exited with code: ', returnCode);
        resolve();
      });
    });
  }); 
};

// Run all tests
const tasks = config
  .filter(
    process.env.E2E_CONFIG_INDEX 
      ? (_, index) => index === +process.env.E2E_CONFIG_INDEX 
      : configPredicate
  )
  .reduce((tasks, config) => {
    const task = getTask(config);
    tasks.push(task);
    return tasks;
  }, []);

function runNextTask() {
  if (tasks.length === 0) {
    console.log('all runs are complete');
    return;
  }
  const task = tasks.shift();
  task().then(() => {
    runNextTask();
  });
}
  
runNextTask();
