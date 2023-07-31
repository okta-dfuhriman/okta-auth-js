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
 *
 */
/* global window, document */
/* eslint-disable complexity, max-statements */
import { AuthSdkError } from '../../errors';
import { OAuthResponse, OktaAuthOAuthInterface, PopupAppearance, TokenParams } from '../types';

export function addListener(eventTarget, name, fn) {
  if (eventTarget.addEventListener) {
    eventTarget.addEventListener(name, fn);
  } else {
    eventTarget.attachEvent('on' + name, fn);
  }
}

export function removeListener(eventTarget, name, fn) {
  if (eventTarget.removeEventListener) {
    eventTarget.removeEventListener(name, fn);
  } else {
    eventTarget.detachEvent('on' + name, fn);
  }
}

export function loadFrame(src) {
  var iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = src;

  return document.body.appendChild(iframe);
}

export function loadPopup(src: string, options: TokenParams) {
  var title = options?.popupParams?.popupTitle || 'External Identity Provider User Authentication';

  var appearance = reducePopupOptions(options?.popupParams?.popupAppearance);
  return window.open(src, title, appearance);
}

function reducePopupOptions(popupParams?: PopupAppearance) {
  let appearance = '';

  const defaultParams = {
    toolbar: false,
    scrollbars: true,
    resizable: true,
    top: 100,
    left: 500,
    width: 600,
    height: 600
  };

  for (const [key, value] of Object.entries({ ...defaultParams, ...popupParams })) {
    switch (value) {
      case false:
        appearance += ` ${key}=no`;
        break;
      case true:
        appearance += ` ${key}=yes`;
        break;
      default:
        if (value !== undefined) {
          appearance += ` ${key}=${value}`;
        }
        break;
    }
  }

  return appearance;
}

export function addPostMessageListener(sdk: OktaAuthOAuthInterface, timeout, state) {
  var responseHandler: (e: MessageEvent<any>) => void;
  var timeoutId;
  var msgReceivedOrTimeout = new Promise<OAuthResponse | undefined>(function (resolve, reject) {

    responseHandler = function responseHandler({ data, origin }) {

      const oauthResponse = sdk?.options?.provider === 'okta-cic'
        && data?.type === 'authorization_response' && data?.response
        ? (data as { response: OAuthResponse, type: string }).response
        : data?.code && data?.state ? data as OAuthResponse
        : undefined;

      if (oauthResponse?.error) {
        return reject(new AuthSdkError(oauthResponse.error));
      }

      if (oauthResponse?.code && oauthResponse?.state === state) {
        // Message is for us!

        // Configuration mismatch between saved token and current app instance
        // This may happen if apps with different issuers are running on the same host url
        // If they share the same storage key, they may read and write tokens in the same location.
        // Common when developing against http://localhost
        // Added option to allow a list of trusted origins to account for more complex use cases.
        const { allowedOrigins = [] } = sdk.options;

        if (![...allowedOrigins, sdk.getIssuerOrigin()].includes(origin)) {
          return reject(new AuthSdkError('The request does not match client configuration'));
        }
        resolve(oauthResponse);
      }

      // A message not meant for us
      return;
    };

    addListener(window, 'message', responseHandler);

    timeoutId = setTimeout(function () {
      reject(new AuthSdkError('OAuth flow timed out'));
    }, timeout || 120000);
  });

  return msgReceivedOrTimeout
    .finally(function () {
      clearTimeout(timeoutId);
      removeListener(window, 'message', responseHandler);
    });
}
